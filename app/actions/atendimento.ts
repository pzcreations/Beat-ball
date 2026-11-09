"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireGestor } from "@/lib/auth";
import { friendlyDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/utils";
import { uuidSchema } from "@/lib/validation";

const observacaoSchema = z
  .string()
  .trim()
  .max(500, "A observação deve ter no máximo 500 caracteres.")
  .optional()
  .transform((v) => (v ? v : undefined));

const moverSchema = z.object({
  pessoaId: uuidSchema,
  etapaId: z.coerce.number().int().min(1, "Escolha a etapa."),
  motivo: z.enum(["sem_resposta", "nao_deseja", "mudou_se", "outro"]).optional(),
  observacao: observacaoSchema,
});

const contatoSchema = z.object({
  pessoaId: uuidSchema,
  canal: z.enum(["whatsapp", "ligacao", "presencial"], { error: "Escolha o canal." }),
  resultado: z.enum(["conversou", "nao_atendeu", "nao_deseja"], { error: "Escolha o resultado do contato." }),
  observacao: observacaoSchema,
});

function revalidarFunil(pessoaId: string) {
  revalidatePath("/gestor", "layout");
  revalidatePath(`/gestor/cadastros/${pessoaId}`);
}

/**
 * Muda a etapa do atendimento (somente gestor). A regra de transição é
 * validada pelo banco (função mover_etapa) — esta ação só repassa.
 */
export async function moverEtapaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireGestor();
  const parsed = moverSchema.safeParse({
    pessoaId: formData.get("pessoaId"),
    etapaId: formData.get("etapaId"),
    motivo: formData.get("motivo") || undefined,
    observacao: formData.get("observacao") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos.", at: Date.now() };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("mover_etapa", {
    p_pessoa_id: parsed.data.pessoaId,
    p_etapa_id: parsed.data.etapaId,
    p_motivo: parsed.data.motivo ?? null,
    p_observacao: parsed.data.observacao ?? null,
  });
  if (error) {
    return {
      status: "error",
      message: error.code === "22023" || error.code === "P0001" ? error.message : friendlyDbError(error, "mover etapa"),
      at: Date.now(),
    };
  }

  revalidarFunil(parsed.data.pessoaId);
  return { status: "success", message: "Etapa atualizada.", at: Date.now() };
}

/** Registra um contato (WhatsApp, ligação ou pessoalmente). Somente gestor. */
export async function registrarContatoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireGestor();
  const parsed = contatoSchema.safeParse({
    pessoaId: formData.get("pessoaId"),
    canal: formData.get("canal"),
    resultado: formData.get("resultado"),
    observacao: formData.get("observacao") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos.", at: Date.now() };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_contato", {
    p_pessoa_id: parsed.data.pessoaId,
    p_canal: parsed.data.canal,
    p_resultado: parsed.data.resultado,
    p_observacao: parsed.data.observacao ?? null,
  });
  if (error) {
    return {
      status: "error",
      message: error.code === "22023" || error.code === "P0001" ? error.message : friendlyDbError(error, "registrar contato"),
      at: Date.now(),
    };
  }

  revalidarFunil(parsed.data.pessoaId);
  const mensagens = {
    conversou: "Contato registrado. A pessoa seguiu para a próxima etapa.",
    nao_atendeu: "Tentativa de contato registrada.",
    nao_deseja: "Contato registrado. O atendimento foi encerrado.",
  } as const;
  return { status: "success", message: mensagens[parsed.data.resultado], at: Date.now() };
}
