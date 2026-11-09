import "server-only";

import { ordenarEtapas, type EtapaInfo } from "@/lib/atendimento";
import { ConnectionError } from "@/lib/auth";
import type { CanalContato, EtapaCor, MotivoEncerramento, OrigemMovimentacao, ResultadoContato } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

/** Etapas em ordem de funil (inclui inativas se `incluirInativas`). */
export async function listEtapas(incluirInativas = false): Promise<EtapaInfo[]> {
  const supabase = await createClient();
  let q = supabase.from("etapas").select("id, nome, cor, tipo, ordem, prazo_horas, ativo");
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
  prazo_horas: number | null;
  total: number;
  atrasados: number;
};

export async function getFunil(): Promise<FunilEtapa[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("funil_resumo");
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
  const [movs, contatos] = await Promise.all([
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
  ];
  // Contato que avançou a etapa acontece no mesmo instante: contato primeiro.
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
