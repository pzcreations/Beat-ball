"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { friendlyDbError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/utils";
import { fullNameSchema, senhaSchema } from "@/lib/validation";

/** Atualiza o próprio nome de exibição (RLS: só o próprio perfil). */
export async function atualizarNomeAction(_prev: ActionState<{ fullName: string }>, formData: FormData): Promise<ActionState<{ fullName: string }>> {
  const user = await requireUser();
  const raw = String(formData.get("fullName") ?? "");
  const parsed = fullNameSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", errors: { fullName: parsed.error.issues[0]?.message }, values: { fullName: raw }, at: Date.now() };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data }).eq("id", user.id);
  if (error) return { status: "error", message: friendlyDbError(error, "atualizar nome"), values: { fullName: raw }, at: Date.now() };

  revalidatePath("/", "layout");
  return { status: "success", message: "Nome atualizado.", at: Date.now() };
}

type SenhaFields = { atual: string; nova: string; confirmacao: string };

/** Troca de senha com confirmação da senha atual (reautenticação). */
export async function alterarSenhaAction(_prev: ActionState<SenhaFields>, formData: FormData): Promise<ActionState<SenhaFields>> {
  const user = await requireUser();
  const atual = String(formData.get("atual") ?? "");
  const nova = String(formData.get("nova") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");

  const errors: Partial<Record<keyof SenhaFields, string>> = {};
  if (!atual) errors.atual = "Informe a senha atual.";
  const novaParsed = senhaSchema.safeParse(nova);
  if (!novaParsed.success) errors.nova = novaParsed.error.issues[0]?.message;
  else if (nova === atual) errors.nova = "A nova senha deve ser diferente da atual.";
  if (nova !== confirmacao) errors.confirmacao = "As senhas não coincidem.";
  if (Object.keys(errors).length > 0) return { status: "error", errors, at: Date.now() };

  if (!rateLimit(`senha:${user.id}`, 5, 15 * 60_000).ok) {
    return { status: "error", message: "Muitas tentativas. Aguarde alguns minutos.", at: Date.now() };
  }

  const supabase = await createClient();
  const reauth = await supabase.auth.signInWithPassword({ email: user.email, password: atual });
  if (reauth.error) return { status: "error", errors: { atual: "Senha atual incorreta." }, at: Date.now() };

  const { error } = await supabase.auth.updateUser({ password: nova });
  if (error) {
    console.error(`[recepcao] alterar senha: ${error.code ?? error.status}`);
    return {
      status: "error",
      message: error.code === "weak_password" ? "A nova senha não atende à política de segurança." : "Não foi possível alterar a senha.",
      at: Date.now(),
    };
  }
  return { status: "success", message: "Senha alterada com sucesso.", at: Date.now() };
}
