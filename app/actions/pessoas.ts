"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireGestor, requireUser } from "@/lib/auth";
import { friendlyDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/utils";
import { fieldErrors, pessoaSchema, uuidSchema } from "@/lib/validation";

type PessoaFields = { nome: string; numero: string };

function readPessoa(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? ""),
    numero: String(formData.get("numero") ?? ""),
  };
}

/** Cadastro de pessoa (recepção e gestor). */
export async function criarPessoaAction(
  _prev: ActionState<PessoaFields>,
  formData: FormData,
): Promise<ActionState<PessoaFields>> {
  await requireUser();
  const raw = readPessoa(formData);
  const parsed = pessoaSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error), values: raw, at: Date.now() };
  }

  const supabase = await createClient();
  // created_by, created_at e updated_at são definidos pelo banco.
  const { error } = await supabase.from("pessoas").insert(parsed.data);
  if (error) {
    return {
      status: "error",
      message: friendlyDbError(error, "criar pessoa"),
      values: raw,
      at: Date.now(),
    };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Cadastro realizado com sucesso.", at: Date.now() };
}

/** Edição de cadastro (somente gestor; o RLS também impõe esta regra). */
export async function atualizarPessoaAction(
  _prev: ActionState<PessoaFields>,
  formData: FormData,
): Promise<ActionState<PessoaFields>> {
  await requireGestor();
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: "Registro inválido.", at: Date.now() };

  const raw = readPessoa(formData);
  const parsed = pessoaSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error), values: raw, at: Date.now() };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pessoas")
    .update(parsed.data)
    .eq("id", id.data)
    .select("id");

  if (error) {
    return { status: "error", message: friendlyDbError(error, "atualizar pessoa"), values: raw, at: Date.now() };
  }
  if (!data || data.length === 0) {
    return { status: "error", message: "Registro não encontrado ou sem permissão.", values: raw, at: Date.now() };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Alterações salvas.", at: Date.now() };
}

/** Exclusão (somente gestor), chamada após confirmação explícita. */
export async function excluirPessoaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireGestor();
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: "Registro inválido.", at: Date.now() };

  const supabase = await createClient();
  const { data, error } = await supabase.from("pessoas").delete().eq("id", id.data).select("id");
  if (error) return { status: "error", message: friendlyDbError(error, "excluir pessoa"), at: Date.now() };
  if (!data || data.length === 0) {
    return { status: "error", message: "Registro não encontrado ou sem permissão.", at: Date.now() };
  }

  revalidatePath("/", "layout");
  redirect("/gestor/cadastros?msg=excluido");
}
