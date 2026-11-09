"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireGestor } from "@/lib/auth";
import { friendlyDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/utils";

const CORES = ["amarelo", "laranja", "azul_claro", "azul", "marinho", "lilas", "verde_agua", "verde", "cinza"] as const;

const nome = (max: number) =>
  z
    .string({ error: "Informe o nome." })
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(2, "Nome muito curto.").max(max, `Use no máximo ${max} caracteres.`));

const id = z.coerce.number().int().min(1);

/** Prazo informado em horas ou dias → horas (vazio = sem prazo). */
const prazoSchema = z
  .object({
    valor: z.string().trim().optional(),
    unidade: z.enum(["horas", "dias"]).default("horas"),
  })
  .transform(({ valor, unidade }, ctx) => {
    if (!valor) return null;
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 1) {
      ctx.addIssue({ code: "custom", message: "O prazo deve ser um número inteiro maior que zero." });
      return z.NEVER;
    }
    const horas = unidade === "dias" ? n * 24 : n;
    if (horas > 8760) {
      ctx.addIssue({ code: "custom", message: "O prazo máximo é de 365 dias." });
      return z.NEVER;
    }
    return horas;
  });

function done(message: string): ActionState {
  revalidatePath("/gestor", "layout");
  return { status: "success", message, at: Date.now() };
}
function fail(message: string): ActionState {
  return { status: "error", message, at: Date.now() };
}
function dbFail(error: { code?: string; message?: string }, ctx: string): ActionState {
  return fail(error.code === "P0001" ? (error.message ?? "Operação não permitida.") : friendlyDbError(error, ctx));
}

/* ------------------------------- Etapas -------------------------------- */

export async function salvarEtapaAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireGestor();
  const parsed = z
    .object({ id, nome: nome(60), cor: z.enum(CORES, { error: "Cor inválida." }), prazo: prazoSchema })
    .safeParse({
      id: fd.get("id"),
      nome: fd.get("nome"),
      cor: fd.get("cor"),
      prazo: { valor: fd.get("prazoValor") ?? undefined, unidade: fd.get("prazoUnidade") ?? undefined },
    });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("etapas")
    .update({ nome: parsed.data.nome, cor: parsed.data.cor, prazo_horas: parsed.data.prazo })
    .eq("id", parsed.data.id)
    .select("id");
  if (error) return dbFail(error, "salvar etapa");
  if (!data?.length) return fail("Etapa não encontrada.");
  return done("Etapa salva.");
}

export async function criarEtapaAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireGestor();
  const parsed = z
    .object({ nome: nome(60), cor: z.enum(CORES, { error: "Escolha uma cor." }), prazo: prazoSchema })
    .safeParse({
      nome: fd.get("nome"),
      cor: fd.get("cor"),
      prazo: { valor: fd.get("prazoValor") ?? undefined, unidade: fd.get("prazoUnidade") ?? undefined },
    });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const supabase = await createClient();
  // Nova etapa entra no fim das intermediárias (antes de "concluído").
  const { data: ultima } = await supabase
    .from("etapas")
    .select("ordem")
    .eq("tipo", "intermediaria")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("etapas")
    .insert({ nome: parsed.data.nome, cor: parsed.data.cor, prazo_horas: parsed.data.prazo, ordem: (ultima?.ordem ?? 0) + 10 });
  if (error) return dbFail(error, "criar etapa");
  return done("Etapa criada.");
}

export async function alternarEtapaAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireGestor();
  const parsed = z.object({ id, ativo: z.enum(["true", "false"]) }).safeParse({ id: fd.get("id"), ativo: fd.get("ativo") });
  if (!parsed.success) return fail("Dados inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.from("etapas").update({ ativo: parsed.data.ativo === "true" }).eq("id", parsed.data.id);
  if (error) return dbFail(error, "alternar etapa");
  return done(parsed.data.ativo === "true" ? "Etapa reativada." : "Etapa desativada.");
}

export async function excluirEtapaAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireGestor();
  const parsed = id.safeParse(fd.get("id"));
  if (!parsed.success) return fail("Dados inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.from("etapas").delete().eq("id", parsed.data);
  if (error) return dbFail(error, "excluir etapa");
  return done("Etapa excluída.");
}

/** Sobe/desce uma etapa intermediária trocando a ordem com a vizinha. */
export async function reordenarEtapaAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireGestor();
  const parsed = z.object({ id, direcao: z.enum(["subir", "descer"]) }).safeParse({ id: fd.get("id"), direcao: fd.get("direcao") });
  if (!parsed.success) return fail("Dados inválidos.");

  const supabase = await createClient();
  const { data: lista, error } = await supabase
    .from("etapas")
    .select("id, ordem")
    .eq("tipo", "intermediaria")
    .order("ordem")
    .order("id");
  if (error || !lista) return fail("Não foi possível carregar as etapas.");
  const i = lista.findIndex((e) => e.id === parsed.data.id);
  const j = parsed.data.direcao === "subir" ? i - 1 : i + 1;
  const a = lista[i];
  const b = lista[j];
  if (!a || !b) return fail("Esta etapa já está na extremidade.");

  // Renumera para garantir ordens distintas e troca as duas.
  const novaOrdem = lista.map((e, k) => ({ id: e.id, ordem: (k + 1) * 10 }));
  const oa = novaOrdem[i]!.ordem;
  novaOrdem[i]!.ordem = novaOrdem[j]!.ordem;
  novaOrdem[j]!.ordem = oa;
  for (const e of novaOrdem) {
    const { error: upErr } = await supabase.from("etapas").update({ ordem: e.ordem }).eq("id", e.id);
    if (upErr) return dbFail(upErr, "reordenar etapas");
  }
  return done("Ordem atualizada.");
}

/* ------------------------------- Igrejas ------------------------------- */

export async function salvarIgrejaAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireGestor();
  const parsed = z.object({ id, nome: nome(120) }).safeParse({ id: fd.get("id"), nome: fd.get("nome") });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.from("igrejas").update({ nome: parsed.data.nome }).eq("id", parsed.data.id);
  if (error) return dbFail(error, "salvar igreja");
  return done("Igreja salva.");
}

export async function criarIgrejaAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireGestor();
  const parsed = nome(120).safeParse(fd.get("nome"));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.from("igrejas").insert({ nome: parsed.data });
  if (error) return dbFail(error, "criar igreja");
  return done("Igreja adicionada.");
}

export async function alternarIgrejaAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireGestor();
  const parsed = z.object({ id, ativo: z.enum(["true", "false"]) }).safeParse({ id: fd.get("id"), ativo: fd.get("ativo") });
  if (!parsed.success) return fail("Dados inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.from("igrejas").update({ ativo: parsed.data.ativo === "true" }).eq("id", parsed.data.id);
  if (error) return dbFail(error, "alternar igreja");
  return done(parsed.data.ativo === "true" ? "Igreja reativada." : "Igreja desativada para novos cadastros.");
}

/* ------------------------------ Mensagem ------------------------------- */

export async function salvarMensagemAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireGestor();
  const parsed = z
    .string()
    .trim()
    .min(10, "A mensagem deve ter pelo menos 10 caracteres.")
    .max(1000, "A mensagem deve ter no máximo 1000 caracteres.")
    .safeParse(fd.get("mensagem"));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Mensagem inválida.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("configuracoes")
    .update({ mensagem_whatsapp: parsed.data })
    .eq("id", true)
    .select("id");
  if (error) return dbFail(error, "salvar mensagem");
  if (!data?.length) return fail("Configuração não encontrada.");
  return done("Mensagem salva.");
}
