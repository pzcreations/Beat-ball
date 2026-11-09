import "server-only";

import webpush from "web-push";

import { createAdminClient } from "@/lib/supabase/server";

/**
 * Envio de notificações (Web Push).
 *
 * As chaves VAPID são geradas automaticamente na primeira vez e guardadas em
 * `sistema_config`, tabela que só o servidor (service role) acessa — não é
 * preciso configurar nada na Vercel.
 */

export type TipoNotificacao = "novo_cadastro" | "resumo_diario" | "lembrete_visita" | "alerta_atraso" | "teste";

export type Notificacao = {
  title: string;
  body: string;
  /** Página aberta ao tocar na notificação (caminho interno). */
  url: string;
  /** Agrupa/substitui notificações do mesmo tipo. */
  tag?: string;
};

type Vapid = { publicKey: string; privateKey: string; subject: string };

let cache: Vapid | null = null;

/** Chaves VAPID (cria e salva na primeira chamada). */
export async function getVapid(): Promise<Vapid> {
  if (cache) return cache;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sistema_config")
    .select("vapid_public, vapid_private, vapid_subject, site_url")
    .eq("id", true)
    .single();
  if (error || !data) throw new Error("Configuração do sistema indisponível.");

  if (data.vapid_public && data.vapid_private) {
    // Identificação do remetente: o endereço do próprio site (aceito pela
    // Apple e pelo Google). Endereços genéricos podem ser recusados.
    const subject = data.site_url ?? (data.vapid_subject?.includes("example.com") ? null : data.vapid_subject);
    const v = { publicKey: data.vapid_public, privateKey: data.vapid_private, subject: subject ?? "mailto:recepcao@recepcao.app" };
    if (data.site_url) cache = v; // só guarda em cache quando o endereço já é conhecido
    return v;
  }

  const keys = webpush.generateVAPIDKeys();
  // Grava só se ainda estiver vazio (evita corrida entre instâncias).
  await admin
    .from("sistema_config")
    .update({ vapid_public: keys.publicKey, vapid_private: keys.privateKey, vapid_subject: null })
    .eq("id", true)
    .is("vapid_public", null);
  cache = null;
  return getVapid();
}

export async function getVapidPublicKey() {
  return (await getVapid()).publicKey;
}

/**
 * Envia para os usuários informados, respeitando as preferências de cada um.
 * Assinaturas expiradas (404/410) são removidas automaticamente.
 */
export type ResultadoEnvio = { enviados: number; aparelhos: number; falhas: string[] };

export async function enviarPara(userIds: string[], tipo: TipoNotificacao, n: Notificacao): Promise<ResultadoEnvio> {
  const vazio: ResultadoEnvio = { enviados: 0, aparelhos: 0, falhas: [] };
  if (userIds.length === 0) return vazio;
  const admin = createAdminClient();
  let destinatarios = [...new Set(userIds)];

  if (tipo !== "teste") {
    const { data: prefs } = await admin.from("notificacao_prefs").select("*").in("user_id", destinatarios);
    const desligados = new Set(
      (prefs ?? []).filter((p) => (p as Record<string, unknown>)[tipo] === false).map((p) => p.user_id),
    );
    destinatarios = destinatarios.filter((id) => !desligados.has(id));
  }
  if (destinatarios.length === 0) return vazio;

  const { data: subs, error } = await admin
    .from("push_assinaturas")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", destinatarios);
  if (error || !subs?.length) return vazio;

  const vapid = await getVapid();
  const payload = JSON.stringify({ ...n, tag: n.tag ?? tipo });
  let enviados = 0;
  const falhas: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          {
            vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
            TTL: 60 * 60 * 12,
            urgency: tipo === "lembrete_visita" ? "high" : "normal",
          },
        );
        enviados++;
        await admin.from("push_assinaturas").update({ last_success_at: new Date().toISOString() }).eq("id", s.id);
      } catch (e) {
        const err = e as { statusCode?: number; body?: string };
        const status = err.statusCode;
        const motivo = `${status ?? "rede"}${err.body ? ` ${String(err.body).slice(0, 120)}` : ""}`;
        falhas.push(`${new URL(s.endpoint).host}: ${motivo}`);
        if (status === 404 || status === 410) {
          await admin.from("push_assinaturas").delete().eq("id", s.id);
        } else {
          console.error(`[recepcao] push falhou: ${motivo}`);
        }
      }
    }),
  );
  return { enviados, aparelhos: subs.length, falhas };
}

/** IDs dos gestores ativos. */
export async function gestoresAtivos() {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id").eq("role", "gestor").eq("active", true);
  return (data ?? []).map((p) => p.id);
}
