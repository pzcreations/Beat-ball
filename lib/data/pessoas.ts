import "server-only";

import { ConnectionError } from "@/lib/auth";
import { periodoStart } from "@/lib/dates";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, normalizeSearch, type Filtros } from "@/lib/validation";

export const PAGE_SIZE = 20;

export type PessoaListItem = {
  id: string;
  nome: string;
  numero: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  autor: { full_name: string } | null;
};

/**
 * Aplica busca/filtros a uma consulta de pessoas. Os valores vêm da URL e já
 * passaram por filtrosSchema; a API do Supabase envia tudo parametrizado
 * (sem concatenação de SQL), e os curingas do ILIKE são escapados.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters<Q extends { ilike: any; gte: any; eq: any }>(query: Q, filtros: Filtros): Q {
  let q = query;
  const term = filtros.q?.trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    const hasLetters = /\p{L}/u.test(term);
    if (!hasLetters && digits.length > 0) {
      q = q.ilike("numero", `%${escapeLike(digits)}%`);
    } else {
      q = q.ilike("nome_busca", `%${escapeLike(normalizeSearch(term))}%`);
    }
  }
  const start = periodoStart(filtros.periodo, env.timezone);
  if (start) q = q.gte("created_at", start.toISOString());
  if (filtros.responsavel) q = q.eq("created_by", filtros.responsavel);
  return q;
}

/** Lista paginada. O RLS do banco define QUAIS registros cada perfil enxerga. */
export async function listPessoas(filtros: Filtros, opts: { withAuthor: boolean }) {
  const supabase = await createClient();
  const page = filtros.pagina ?? 1;
  const from = (page - 1) * PAGE_SIZE;

  const columns = opts.withAuthor
    ? "id, nome, numero, created_at, updated_at, created_by, autor:profiles!pessoas_created_by_fkey(full_name)"
    : "id, nome, numero, created_at, updated_at, created_by";

  let query = supabase.from("pessoas").select(columns, { count: "exact" });
  query = applyFilters(query, filtros);

  switch (filtros.ordem) {
    case "antigos":
      query = query.order("created_at", { ascending: true });
      break;
    case "nome":
      query = query.order("nome_busca", { ascending: true }).order("created_at", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) {
    // Página além do fim: PostgREST responde 416 (PGRST103).
    if (error.code === "PGRST103") return { items: [] as PessoaListItem[], total: count ?? 0, page };
    throw new ConnectionError();
  }

  const items = ((data ?? []) as unknown as PessoaListItem[]).map((p) => ({ ...p, autor: p.autor ?? null }));
  return { items, total: count ?? 0, page };
}

/** Exportação (somente gestor): busca todos os registros filtrados em lotes. */
export async function listPessoasForExport(filtros: Filtros, maxRows = 50_000) {
  const supabase = await createClient();
  const batch = 1000;
  const rows: PessoaListItem[] = [];

  for (let from = 0; from < maxRows; from += batch) {
    let query = supabase
      .from("pessoas")
      .select("id, nome, numero, created_at, updated_at, created_by, autor:profiles!pessoas_created_by_fkey(full_name)");
    query = applyFilters(query, filtros);
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + batch - 1);
    if (error) throw new ConnectionError();
    const chunk = (data ?? []) as unknown as PessoaListItem[];
    rows.push(...chunk);
    if (chunk.length < batch) break;
  }
  return rows;
}

export async function getPessoa(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pessoas")
    .select(
      "id, nome, numero, created_at, updated_at, created_by, updated_by, autor:profiles!pessoas_created_by_fkey(full_name), editor:profiles!pessoas_updated_by_fkey(full_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new ConnectionError();
  return data as
    | (PessoaListItem & { updated_by: string | null; editor: { full_name: string } | null })
    | null;
}

/** Contagem de cadastros feitos pelo próprio usuário a partir de uma data. */
export async function countOwnSince(userId: string, since: Date) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("pessoas")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId)
    .gte("created_at", since.toISOString());
  if (error) throw new ConnectionError();
  return count ?? 0;
}

export async function latestOwn(userId: string, limit = 5) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pessoas")
    .select("id, nome, numero, created_at")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new ConnectionError();
  return data ?? [];
}
