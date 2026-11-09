import "server-only";

import { ConnectionError } from "@/lib/auth";
import { periodoStart } from "@/lib/dates";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { EtapaCor, EtapaTipo } from "@/lib/database.types";
import { escapeLike, normalizeSearch, type Filtros } from "@/lib/validation";

export const PAGE_SIZE = 20;

export type AtendimentoResumo = {
  etapa_desde: string;
  tentativas_contato: number;
  etapa: { id: number; nome: string; cor: EtapaCor; tipo: EtapaTipo; prazo_horas: number | null } | null;
};

export type PessoaListItem = {
  id: string;
  nome: string;
  numero: string;
  igreja_id: number | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  autor: { full_name: string } | null;
  igreja: { nome: string } | null;
  /** Nulo quando o perfil não pode ver a etapa (RLS). */
  atendimento: AtendimentoResumo | null;
};

const ATENDIMENTO_SELECT =
  "atendimento:atendimentos(etapa_desde, tentativas_contato, etapa:etapas(id, nome, cor, tipo, prazo_horas))";
const BASE_SELECT = `id, nome, numero, igreja_id, created_at, updated_at, created_by, igreja:igrejas(nome), ${ATENDIMENTO_SELECT}`;
const AUTOR_SELECT = "autor:profiles!pessoas_created_by_fkey(full_name)";

function normalize(rows: unknown[]): PessoaListItem[] {
  return (rows as PessoaListItem[]).map((p) => ({
    ...p,
    autor: p.autor ?? null,
    igreja: p.igreja ?? null,
    atendimento: p.atendimento ?? null,
  }));
}

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
  if (filtros.igreja) q = q.eq("igreja_id", filtros.igreja);
  if (filtros.etapa) q = q.eq("atendimento.etapa_id", filtros.etapa);
  return q;
}

/** Lista paginada. O RLS do banco define QUAIS registros cada perfil enxerga. */
export async function listPessoas(filtros: Filtros, opts: { withAuthor: boolean }) {
  const supabase = await createClient();
  const page = filtros.pagina ?? 1;
  const from = (page - 1) * PAGE_SIZE;

  // Filtrar por etapa exige junção obrigatória (!inner) com o atendimento.
  const atendimento = filtros.etapa ? ATENDIMENTO_SELECT.replace("atendimentos(", "atendimentos!inner(") : ATENDIMENTO_SELECT;
  const base = BASE_SELECT.replace(ATENDIMENTO_SELECT, atendimento);
  const columns = opts.withAuthor ? `${base}, ${AUTOR_SELECT}` : base;

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

  return { items: normalize(data ?? []), total: count ?? 0, page };
}

/** Exportação (somente gestor): busca todos os registros filtrados em lotes. */
export async function listPessoasForExport(filtros: Filtros, maxRows = 50_000) {
  const supabase = await createClient();
  const batch = 1000;
  const rows: PessoaListItem[] = [];

  for (let from = 0; from < maxRows; from += batch) {
    const atendimento = filtros.etapa ? ATENDIMENTO_SELECT.replace("atendimentos(", "atendimentos!inner(") : ATENDIMENTO_SELECT;
    let query = supabase
      .from("pessoas")
      .select(`${BASE_SELECT.replace(ATENDIMENTO_SELECT, atendimento)}, ${AUTOR_SELECT}`);
    query = applyFilters(query, filtros);
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + batch - 1);
    if (error) throw new ConnectionError();
    const chunk = normalize(data ?? []);
    rows.push(...chunk);
    if (chunk.length < batch) break;
  }
  return rows;
}

export async function getPessoa(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pessoas")
    .select(`${BASE_SELECT}, updated_by, ${AUTOR_SELECT}, editor:profiles!pessoas_updated_by_fkey(full_name)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new ConnectionError();
  if (!data) return null;
  const [p] = normalize([data]);
  return p as PessoaListItem & { updated_by: string | null; editor: { full_name: string } | null };
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
    .select(BASE_SELECT)
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new ConnectionError();
  return normalize(data ?? []);
}
