import "server-only";

import { ordenarEtapas, type EtapaInfo } from "@/lib/atendimento";
import { ConnectionError } from "@/lib/auth";
import { env } from "@/lib/env";
import type {
  CanalContato,
  EtapaCor,
  EtapaPapel,
  MotivoEncerramento,
  OrigemMovimentacao,
  ResultadoContato,
  SituacaoVisita,
} from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

/** Etapas em ordem de funil (inclui inativas se `incluirInativas`). */
export async function listEtapas(incluirInativas = false): Promise<EtapaInfo[]> {
  const supabase = await createClient();
  let q = supabase.from("etapas").select("id, nome, cor, tipo, ordem, prazo_horas, ativo, papel");
  if (!incluirInativas) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw new ConnectionError();
  return ordenarEtapas(data ?? []);
}

export async function listIgrejas(incluirInativas = false) {
  const supabase = await createClient();
  let q = supabase.from("igrejas").select("id, nome, ativo").order("nome");
  if (!incluirInativas) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw new ConnectionError();
  return data ?? [];
}

export async function getMensagemWhatsApp() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("configuracoes").select("mensagem_whatsapp").maybeSingle();
  if (error) throw new ConnectionError();
  return data?.mensagem_whatsapp ?? "Olá, {primeiro_nome}!";
}

export type FunilEtapa = {
  id: number;
  nome: string;
  cor: EtapaCor;
  tipo: EtapaInfo["tipo"];
  papel: EtapaPapel | null;
  prazo_horas: number | null;
  total: number;
  atrasados: number;
};

export async function getFunil(): Promise<FunilEtapa[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("funil_resumo", { p_tz: env.timezone });
  if (error) throw new ConnectionError();
  return (data as unknown as FunilEtapa[]) ?? [];
}

export type CartaoAtendimento = {
  pessoa_id: string;
  etapa_id: number;
  etapa_desde: string;
  tentativas_contato: number;
  pessoa: { id: string; nome: string; numero: string; igreja: { nome: string } | null } | null;
};

/** Pessoas de uma etapa. Mais antigas primeiro (mais urgentes). */
export async function listCartoes(etapaId: number, limite = 50, maisRecentesPrimeiro = false) {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("atendimentos")
    .select("pessoa_id, etapa_id, etapa_desde, tentativas_contato, pessoa:pessoas(id, nome, numero, igreja:igrejas(nome))", {
      count: "exact",
    })
    .eq("etapa_id", etapaId)
    .order("etapa_desde", { ascending: !maisRecentesPrimeiro })
    .limit(limite);
  if (error) throw new ConnectionError();
  const cartoes = ((data ?? []) as unknown as CartaoAtendimento[]).filter((c) => c.pessoa);
  return { cartoes, total: count ?? cartoes.length };
}

export type EventoLinhaDoTempo =
  | {
      tipo: "visita";
      id: string;
      em: string;
      autor: string | null;
      visita: Visita;
    }
  | {
      tipo: "movimentacao";
      id: string;
      em: string;
      autor: string | null;
      origem: OrigemMovimentacao;
      de: { nome: string; cor: EtapaCor } | null;
      para: { nome: string; cor: EtapaCor } | null;
      motivo: MotivoEncerramento | null;
      observacao: string | null;
    }
  | {
      tipo: "contato";
      id: string;
      em: string;
      autor: string | null;
      canal: CanalContato;
      resultado: ResultadoContato;
      observacao: string | null;
    };

/** Linha do tempo do atendimento (somente gestor — garantido pelo RLS). */
export async function getLinhaDoTempo(pessoaId: string): Promise<EventoLinhaDoTempo[]> {
  const supabase = await createClient();
  const [movs, contatos, visitas] = await Promise.all([
    supabase
      .from("movimentacoes")
      .select(
        "id, created_at, origem, motivo, observacao, autor:profiles!movimentacoes_created_by_fkey(full_name), de:etapas!movimentacoes_de_etapa_id_fkey(nome, cor), para:etapas!movimentacoes_para_etapa_id_fkey(nome, cor)",
      )
      .eq("pessoa_id", pessoaId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("contatos")
      .select("id, created_at, canal, resultado, observacao, autor:profiles!contatos_created_by_fkey(full_name)")
      .eq("pessoa_id", pessoaId)
      .order("created_at", { ascending: false })
      .limit(100),
    listVisitasDaPessoa(pessoaId),
  ]);
  if (movs.error || contatos.error) throw new ConnectionError();

  const eventos: EventoLinhaDoTempo[] = [
    ...(movs.data ?? []).map((m) => ({
      tipo: "movimentacao" as const,
      id: `m${m.id}`,
      em: m.created_at,
      autor: m.autor?.full_name ?? null,
      origem: m.origem,
      de: m.de ?? null,
      para: m.para ?? null,
      motivo: m.motivo,
      observacao: m.observacao,
    })),
    ...(contatos.data ?? []).map((c) => ({
      tipo: "contato" as const,
      id: `c${c.id}`,
      em: c.created_at,
      autor: c.autor?.full_name ?? null,
      canal: c.canal,
      resultado: c.resultado,
      observacao: c.observacao,
    })),
    ...visitas.map((v) => ({
      tipo: "visita" as const,
      id: `v${v.id}`,
      em: v.created_at,
      autor: v.autor?.full_name ?? null,
      visita: v,
    })),
  ];
  // Movimentações geradas por um contato/visita acontecem no mesmo instante.
  return eventos.sort((a, b) => b.em.localeCompare(a.em) || (a.tipo === "movimentacao" ? -1 : 1));
}

/** Pessoas com prazo da etapa vencido (mais antigas primeiro). */
export async function listAtrasados(etapas: EtapaInfo[], limite = 6) {
  const supabase = await createClient();
  const comPrazo = etapas.filter((e) => e.prazo_horas && e.tipo !== "concluida" && e.tipo !== "encerrada");
  const resultados = await Promise.all(
    comPrazo.map(async (e) => {
      const limiteData = new Date(Date.now() - e.prazo_horas! * 3_600_000).toISOString();
      const { data, error } = await supabase
        .from("atendimentos")
        .select("pessoa_id, etapa_id, etapa_desde, tentativas_contato, pessoa:pessoas(id, nome, numero, igreja:igrejas(nome))")
        .eq("etapa_id", e.id)
        .lt("etapa_desde", limiteData)
        .order("etapa_desde", { ascending: true })
        .limit(limite);
      if (error) throw new ConnectionError();
      return ((data ?? []) as unknown as CartaoAtendimento[]).filter((c) => c.pessoa).map((c) => ({ ...c, etapa: e }));
    }),
  );
  return resultados
    .flat()
    .sort((a, b) => a.etapa_desde.localeCompare(b.etapa_desde))
    .slice(0, limite);
}

/* ------------------------------- Visitas -------------------------------- */

export type Visita = {
  id: string;
  pessoa_id: string;
  agendada_para: string;
  endereco: string;
  visitante_id: string;
  observacao: string | null;
  situacao: SituacaoVisita;
  resultado_obs: string | null;
  created_at: string;
  updated_at: string;
  visitante: { full_name: string } | null;
  autor: { full_name: string } | null;
};

const VISITA_SELECT =
  "id, pessoa_id, agendada_para, endereco, visitante_id, observacao, situacao, resultado_obs, created_at, updated_at, visitante:profiles!visitas_visitante_id_fkey(full_name), autor:profiles!visitas_created_by_fkey(full_name)";

/** Gestores ativos (quem pode fazer visitas). */
export async function listGestores() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "gestor")
    .eq("active", true)
    .order("full_name");
  if (error) throw new ConnectionError();
  return data ?? [];
}

export async function listVisitasDaPessoa(pessoaId: string): Promise<Visita[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visitas")
    .select(VISITA_SELECT)
    .eq("pessoa_id", pessoaId)
    .order("agendada_para", { ascending: false })
    .limit(50);
  if (error) throw new ConnectionError();
  return (data ?? []) as unknown as Visita[];
}

/** Visitas pendentes das pessoas informadas (mapa pessoa → visita). */
export async function mapaVisitasPendentes(pessoaIds: string[]) {
  const mapa = new Map<string, Visita>();
  if (pessoaIds.length === 0) return mapa;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visitas")
    .select(VISITA_SELECT)
    .eq("situacao", "agendada")
    .in("pessoa_id", pessoaIds);
  if (error) throw new ConnectionError();
  for (const v of (data ?? []) as unknown as Visita[]) mapa.set(v.pessoa_id, v);
  return mapa;
}

export type VisitaAgenda = Visita & {
  pessoa: { id: string; nome: string; numero: string; igreja: { nome: string } | null } | null;
};

/** Visitas pendentes até `ate` (inclui as atrasadas, sem registro). */
export async function listAgenda(ate: Date, visitanteId?: string): Promise<VisitaAgenda[]> {
  const supabase = await createClient();
  let q = supabase
    .from("visitas")
    .select(`${VISITA_SELECT}, pessoa:pessoas(id, nome, numero, igreja:igrejas(nome))`)
    .eq("situacao", "agendada")
    .lt("agendada_para", ate.toISOString())
    .order("agendada_para", { ascending: true })
    .limit(300);
  if (visitanteId) q = q.eq("visitante_id", visitanteId);
  const { data, error } = await q;
  if (error) throw new ConnectionError();
  return ((data ?? []) as unknown as VisitaAgenda[]).filter((v) => v.pessoa);
}

/** Últimas visitas registradas (realizadas, faltas, canceladas). */
export async function listVisitasRegistradas(limite = 15, visitanteId?: string): Promise<VisitaAgenda[]> {
  const supabase = await createClient();
  let q = supabase
    .from("visitas")
    .select(`${VISITA_SELECT}, pessoa:pessoas(id, nome, numero, igreja:igrejas(nome))`)
    .neq("situacao", "agendada")
    .order("agendada_para", { ascending: false })
    .limit(limite);
  if (visitanteId) q = q.eq("visitante_id", visitanteId);
  const { data, error } = await q;
  if (error) throw new ConnectionError();
  return ((data ?? []) as unknown as VisitaAgenda[]).filter((v) => v.pessoa);
}
