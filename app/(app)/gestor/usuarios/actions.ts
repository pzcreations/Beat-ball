"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireGestor } from "@/lib/auth";
import { friendlyDbError } from "@/lib/errors";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/utils";
import { editarUsuarioSchema, fieldErrors, novoUsuarioSchema, senhaSchema, uuidSchema } from "@/lib/validation";

/** Bloqueio "permanente" no Auth (até ser reativado pelo gestor). */
const BAN_FOREVER = "876000h";

type NovoFields = { fullName: string; email: string; senha: string; role: string };

/**
 * Cria um usuário. Usa a chave secreta SOMENTE depois de confirmar, no
 * servidor e pelo banco, que quem pede é um gestor ativo. O papel vai em
 * app_metadata (que o próprio usuário não consegue alterar).
 */
export async function criarUsuarioAction(_prev: ActionState<NovoFields>, formData: FormData): Promise<ActionState<NovoFields>> {
  const gestor = await requireGestor();

  const raw = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    senha: String(formData.get("senha") ?? ""),
    role: String(formData.get("role") ?? "recepcao"),
  };
  const parsed = novoUsuarioSchema.safeParse({ ...raw, canViewRecords: formData.get("canViewRecords") === "on" });
  const values = { fullName: raw.fullName, email: raw.email, role: raw.role };
  if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error), values, at: Date.now() };

  const { fullName, email, senha, role, canViewRecords } = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: {
      provisioned: true,
      app_role: role,
      can_view_records: role === "gestor" ? true : canViewRecords,
      provisioned_by: gestor.id,
    },
  });

  if (error) {
    const exists = error.code === "email_exists" || error.status === 422 || /already/i.test(error.message);
    console.error(`[recepcao] criar usuário: ${error.code ?? error.status}`);
    return {
      status: "error",
      message: exists
        ? "Já existe um usuário com este e-mail."
        : error.code === "weak_password"
          ? "A senha não atende à política de segurança do servidor."
          : "Não foi possível criar o usuário. Tente novamente.",
      values,
      at: Date.now(),
    };
  }

  revalidatePath("/gestor/usuarios");
  redirect("/gestor/usuarios?msg=criado");
}

type EditarFields = { fullName: string };

/** Atualiza nome, perfil, permissão de consulta e status de acesso. */
export async function atualizarUsuarioAction(_prev: ActionState<EditarFields>, formData: FormData): Promise<ActionState<EditarFields>> {
  const gestor = await requireGestor();

  const parsed = editarUsuarioSchema.safeParse({
    id: formData.get("id"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
    canViewRecords: formData.get("canViewRecords") === "on",
    active: formData.get("active") === "on",
  });
  const values = { fullName: String(formData.get("fullName") ?? "") };
  if (!parsed.success) return { status: "error", errors: fieldErrors(parsed.error), values, at: Date.now() };

  const { id, fullName, role, canViewRecords, active } = parsed.data;

  if (id === gestor.id && (role !== "gestor" || !active)) {
    return {
      status: "error",
      message: "Você não pode remover o seu próprio acesso de gestor. Peça a outro gestor.",
      values,
      at: Date.now(),
    };
  }

  // Atualização feita COM a sessão do gestor: passa pelo RLS e pelos
  // triggers (auditoria com autor e proteção do último gestor).
  const supabase = await createClient();
  const { data: before } = await supabase.from("profiles").select("active").eq("id", id).maybeSingle();
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, role, can_view_records: role === "gestor" ? true : canViewRecords, active })
    .eq("id", id)
    .select("id");

  if (error) return { status: "error", message: friendlyDbError(error, "atualizar usuário"), values, at: Date.now() };
  if (!data || data.length === 0) return { status: "error", message: "Usuário não encontrado.", values, at: Date.now() };

  // Sincroniza o bloqueio no Supabase Auth (impede novos logins/renovações).
  if (before && before.active !== active) {
    const admin = createAdminClient();
    const { error: banError } = await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : BAN_FOREVER });
    if (banError) {
      console.error(`[recepcao] sincronizar bloqueio: ${banError.code ?? banError.status}`);
      return {
        status: "error",
        message:
          "Permissões salvas, mas não foi possível sincronizar o bloqueio de login. O acesso aos dados já está bloqueado; tente salvar novamente.",
        values,
        at: Date.now(),
      };
    }
  }

  revalidatePath("/gestor/usuarios");
  revalidatePath(`/gestor/usuarios/${id}`);
  return { status: "success", message: "Usuário atualizado.", at: Date.now() };
}

type SenhaFields = { senha: string };

/** Redefine a senha de um usuário (ex.: esquecimento). Registrado no histórico. */
export async function redefinirSenhaAction(_prev: ActionState<SenhaFields>, formData: FormData): Promise<ActionState<SenhaFields>> {
  await requireGestor();
  const id = uuidSchema.safeParse(formData.get("id"));
  const senha = senhaSchema.safeParse(formData.get("senha"));
  if (!id.success) return { status: "error", message: "Usuário inválido.", at: Date.now() };
  if (!senha.success) return { status: "error", errors: { senha: senha.error.issues[0]?.message }, at: Date.now() };

  // Confirma (com RLS) que o usuário existe antes de usar a chave secreta.
  const supabase = await createClient();
  const { data: alvo } = await supabase.from("profiles").select("id").eq("id", id.data).maybeSingle();
  if (!alvo) return { status: "error", message: "Usuário não encontrado.", at: Date.now() };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id.data, { password: senha.data });
  if (error) {
    console.error(`[recepcao] redefinir senha: ${error.code ?? error.status}`);
    return { status: "error", message: "Não foi possível redefinir a senha.", at: Date.now() };
  }

  await supabase.rpc("registrar_evento", { p_action: "usuario.senha_redefinida", p_entity_id: id.data });
  return { status: "success", message: "Senha redefinida. Informe a nova senha ao usuário por um canal seguro.", at: Date.now() };
}
