"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireGestor } from "@/lib/auth";
import { zonedToUtc } from "@/lib/dates";
import { env } from "@/lib/env";
import { friendlyDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/utils";
import { uuidSchema } from "@/lib/validation";

const agendamentoSchema = z.object({
  data: z.string({ error: "Informe a data." }).regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
  hora: z.string({ error: "Informe o horário." }).regex(/^\d{2}:\d{2}$/, "Informe o horário."),
  endereco: z
    .string({ error: "Informe o endereço." })
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(5, "Informe o endereço completo.").max(300, "Endereço muito longo.")),
  visitanteId: uuidSchema,
  observacao: z
    .string()
    .trim()
    .max(500, "A observação deve ter no máximo 500 caracteres.")
    .optional()
    .transform((v) => (v ? v : null)),
});

function lerAgendamento(fd: FormData) {
  return agendamentoSchema.safeParse({
    data: fd.get("data"),
    hora: fd.get("hora"),
    endereco: fd.get("endereco"),
    visitanteId: fd.get("visitanteId"),
    observacao: fd.get("observacao") ?? undefined,
  });
}

function erro(error: { code?: string; message?: string }, ctx: string): ActionState {
  return {
    status: "error",
    message: error.code === "22023" || error.code === "P0001" ? (error.message ?? "Dados inválidos.") : friendlyDbError(error, ctx),
    at: Date.now(),
  };
}

function revalidar() {
  revalidatePath("/gestor", "layout");
}

/** Agenda uma visita (somente gestor). O banco move a pessoa de etapa. */
export async function agendarVisitaAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireGestor();
  const pessoa = uuidSchema.safeParse(fd.get("pessoaId"));
  const parsed = lerAgendamento(fd);
  if (!pessoa.success) return { status: "error", message: "Pessoa inválida.", at: Date.now() };
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos.", at: Date.now() };

  const quando = zonedToUtc(parsed.data.data, parsed.data.hora, env.timezone);
  if (!quando) return { status: "error", message: "Data ou horário inválido.", at: Date.now() };

  const supabase = await createClient();
  const { error } = await supabase.rpc("agendar_visita", {
    p_pessoa_id: pessoa.data,
    p_agendada_para: quando.toISOString(),
    p_endereco: parsed.data.endereco,
    p_visitante_id: parsed.data.visitanteId,
    p_observacao: parsed.data.observacao,
  });
  if (error) return erro(error, "agendar visita");
  revalidar();
  return { status: "success", message: "Visita agendada.", at: Date.now() };
}

/** Reagenda a visita pendente. */
export async function reagendarVisitaAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireGestor();
  const visita = uuidSchema.safeParse(fd.get("visitaId"));
  const parsed = lerAgendamento(fd);
  if (!visita.success) return { status: "error", message: "Visita inválida.", at: Date.now() };
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos.", at: Date.now() };

  const quando = zonedToUtc(parsed.data.data, parsed.data.hora, env.timezone);
  if (!quando) return { status: "error", message: "Data ou horário inválido.", at: Date.now() };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reagendar_visita", {
    p_visita_id: visita.data,
    p_agendada_para: quando.toISOString(),
    p_endereco: parsed.data.endereco,
    p_visitante_id: parsed.data.visitanteId,
    p_observacao: parsed.data.observacao,
  });
  if (error) return erro(error, "reagendar visita");
  revalidar();
  return { status: "success", message: "Visita reagendada.", at: Date.now() };
}

/** Registra o resultado: realizada, pessoa ausente ou cancelada. */
export async function registrarVisitaAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireGestor();
  const parsed = z
    .object({
      visitaId: uuidSchema,
      situacao: z.enum(["realizada", "faltou", "cancelada"], { error: "Escolha o resultado da visita." }),
      observacao: z
        .string()
        .trim()
        .max(500, "A observação deve ter no máximo 500 caracteres.")
        .optional()
        .transform((v) => (v ? v : null)),
    })
    .safeParse({ visitaId: fd.get("visitaId"), situacao: fd.get("situacao"), observacao: fd.get("observacao") ?? undefined });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos.", at: Date.now() };

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_visita", {
    p_visita_id: parsed.data.visitaId,
    p_situacao: parsed.data.situacao,
    p_observacao: parsed.data.observacao,
  });
  if (error) return erro(error, "registrar visita");
  revalidar();
  const msg = {
    realizada: "Visita registrada como realizada.",
    faltou: "Ausência registrada. A pessoa voltou para o agendamento.",
    cancelada: "Visita cancelada. A pessoa voltou para o agendamento.",
  } as const;
  return { status: "success", message: msg[parsed.data.situacao], at: Date.now() };
}
