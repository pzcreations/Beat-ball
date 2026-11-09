"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { requireGestor } from "@/lib/auth";
import { enviarPara } from "@/lib/push";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/utils";

const assinaturaSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(10).max(100),
  }),
});

/**
 * Registra o endereço público do site para o agendador (pg_cron) chamar a
 * rota de notificações. Feito na primeira vez em que um gestor ativa as
 * notificações, a partir do próprio acesso (https obrigatório).
 */
async function registrarEnderecoDoSite() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (!host || proto !== "https" || !/^[a-zA-Z0-9.-]+(:\d+)?$/.test(host)) return;
  const admin = createAdminClient();
  // Só na primeira vez (para trocar de domínio depois, ver README).
  await admin.from("sistema_config").update({ site_url: `https://${host}` }).eq("id", true).is("site_url", null);
}

/** Salva a assinatura deste aparelho (somente gestor). */
export async function salvarAssinaturaAction(raw: unknown): Promise<ActionState> {
  const gestor = await requireGestor();
  const parsed = assinaturaSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", message: "Assinatura inválida.", at: Date.now() };

  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  const admin = createAdminClient();
  // O mesmo aparelho pode ter pertencido a outro usuário: substitui.
  await admin.from("push_assinaturas").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await admin.from("push_assinaturas").insert({
    user_id: gestor.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: ua,
  });
  if (error) {
    console.error(`[recepcao] salvar assinatura: ${error.code}`);
    return { status: "error", message: "Não foi possível ativar as notificações.", at: Date.now() };
  }
  await registrarEnderecoDoSite();
  return { status: "success", message: "Notificações ativadas neste aparelho.", at: Date.now() };
}

/** Remove a assinatura deste aparelho (RLS: só as próprias). */
export async function removerAssinaturaAction(endpoint: string): Promise<ActionState> {
  await requireGestor();
  const parsed = z.string().url().max(1000).safeParse(endpoint);
  if (!parsed.success) return { status: "error", message: "Aparelho inválido.", at: Date.now() };
  const supabase = await createClient();
  await supabase.from("push_assinaturas").delete().eq("endpoint", parsed.data);
  return { status: "success", message: "Notificações desativadas neste aparelho.", at: Date.now() };
}

/** Preferências: o que este gestor quer receber. */
export async function salvarPreferenciasAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const gestor = await requireGestor();
  const prefs = {
    novo_cadastro: fd.get("novo_cadastro") === "on",
    resumo_diario: fd.get("resumo_diario") === "on",
    lembrete_visita: fd.get("lembrete_visita") === "on",
    alerta_atraso: fd.get("alerta_atraso") === "on",
  };
  const supabase = await createClient();
  const { data } = await supabase.from("notificacao_prefs").select("user_id").eq("user_id", gestor.id).maybeSingle();
  const { error } = data
    ? await supabase.from("notificacao_prefs").update(prefs).eq("user_id", gestor.id)
    : await supabase.from("notificacao_prefs").insert(prefs);
  if (error) return { status: "error", message: "Não foi possível salvar as preferências.", at: Date.now() };
  return { status: "success", message: "Preferências salvas.", at: Date.now() };
}

/** Envia uma notificação de teste para os aparelhos deste gestor. */
export async function enviarTesteAction(): Promise<ActionState> {
  const gestor = await requireGestor();
  const { enviados } = await enviarPara([gestor.id], "teste", {
    title: "Recepção",
    body: "Notificações funcionando neste aparelho. 🙏",
    url: "/gestor",
    tag: "teste",
  });
  return enviados > 0
    ? { status: "success", message: "Notificação de teste enviada.", at: Date.now() }
    : { status: "error", message: "Nenhum aparelho com notificações ativas.", at: Date.now() };
}
