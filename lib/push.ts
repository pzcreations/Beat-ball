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
    .select("vapid_public, vapid_private, vapid_subject")
    .eq("id", true)
    .single();
  if (error || !data) throw new Error("Configuração do sistema indisponível.");

  if (data.vapid_public && data.vapid_private) {
    cache = { publicKey: data.vapid_public, privateKey: data.vapid_private, subject: data.vapid_subject ?? "mailto:contato@example.com" };
    return cache;
  }

  const keys = webpush.generateVAPIDKeys();
  // Grava só se ainda estiver vazio (evita corrida entre instâncias).
  await admin
    .from("sistema_config")
    .update({ vapid_public: keys.publicKey, vapid_private: keys.privateKey, vapid_subject: "mailto:contato@example.com" })
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
export async function enviarPara(userIds: string[], tipo: TipoNotificacao, n: Notificacao) {
  if (userIds.length === 0) return { enviados: 0 };
  const admin = createAdminClient();
  let destinatarios = [...new Set(userIds)];

  if (tipo !== "teste") {
    const { data: prefs } = await admin.from("notificacao_prefs").select("*").in("user_id", destinatarios);
    const desligados = new Set(
      (prefs ?? []).filter((p) => (p as Record<string, unknown>)[tipo] === false).map((p) => p.user_id),
    );
    destinatarios = destinatarios.filter((id) => !desligados.has(id));
  }
  if (destinatarios.length === 0) return { enviados: 0 };

  const { data: subs, error } = await admin
    .from("push_assinaturas")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", destinatarios);
  if (error || !subs?.length) return { enviados: 0 };

  const vapid = await getVapid();
  const payload = JSON.stringify({ ...n, tag: n.tag ?? tipo });
  let enviados = 0;

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
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_assinaturas").delete().eq("id", s.id);
        } else {
          console.error(`[recepcao] push falhou: ${status ?? "erro de rede"}`);
        }
      }
    }),
  );
  return { enviados };
}

/** IDs dos gestores ativos. */
export async function gestoresAtivos() {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id").eq("role", "gestor").eq("active", true);
  return (data ?? []).map((p) => p.id);
}
