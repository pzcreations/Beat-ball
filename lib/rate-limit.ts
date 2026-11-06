import "server-only";

/**
 * Limitador simples de tentativas (janela deslizante, em memória).
 *
 * Complementa o rate limit do próprio Supabase Auth. Como as chamadas ao
 * Supabase partem do servidor, este limite por IP+e-mail é a barreira contra
 * força bruta no login. Em implantações com várias instâncias, cada instância
 * mantém sua contagem; para um limite global, troque por um armazenamento
 * compartilhado (ex.: Redis/Upstash).
 */
const buckets = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    const retryAfterMs = windowMs - (now - (hits[0] ?? now));
    return { ok: false as const, retryAfterMs };
  }

  hits.push(now);
  buckets.set(key, hits);

  if (buckets.size > MAX_KEYS) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
      if (buckets.size <= MAX_KEYS / 2) break;
    }
  }
  return { ok: true as const };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
