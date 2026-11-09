import type { CanalContato, EtapaCor, EtapaPapel, EtapaTipo, MotivoEncerramento, ResultadoContato, SituacaoVisita } from "@/lib/database.types";

/** Etapa como usada pela interface. */
export type EtapaInfo = {
  id: number;
  nome: string;
  cor: EtapaCor;
  tipo: EtapaTipo;
  ordem: number;
  prazo_horas: number | null;
  ativo: boolean;
  papel: EtapaPapel | null;
};

/** Classes de cor de cada etapa (paleta institucional, tons suaves). */
export const ETAPA_COR: Record<EtapaCor, { badge: string; dot: string; label: string; hex: string }> = {
  amarelo: { badge: "bg-[#fdf6e0] text-[#8a5a00] border-[#f1dfa6]", dot: "bg-[#e0a800]", label: "Amarelo", hex: "#e0a800" },
  laranja: { badge: "bg-[#fdf0e6] text-[#9a4a0b] border-[#f3d2b6]", dot: "bg-[#e07b2a]", label: "Laranja", hex: "#e07b2a" },
  azul_claro: { badge: "bg-azure-50 text-navy-700 border-azure-200", dot: "bg-azure-500", label: "Azul-claro", hex: "#4a8bd1" },
  azul: { badge: "bg-azure-100 text-navy-800 border-azure-300", dot: "bg-navy-600", label: "Azul", hex: "#2a5f9e" },
  marinho: { badge: "bg-navy-900 text-white border-navy-900", dot: "bg-navy-900", label: "Azul-escuro", hex: "#0b2545" },
  lilas: { badge: "bg-[#f3f0fb] text-[#5b3f99] border-[#ddd3f3]", dot: "bg-[#8065c4]", label: "Lilás", hex: "#8065c4" },
  verde_agua: { badge: "bg-[#e9f7f5] text-[#11695f] border-[#c4e8e2]", dot: "bg-[#2a9d8f]", label: "Verde-água", hex: "#2a9d8f" },
  verde: { badge: "bg-success-bg text-success border-[#cfe9da]", dot: "bg-success", label: "Verde", hex: "#1f7a4d" },
  cinza: { badge: "bg-surface text-muted border-line", dot: "bg-subtle", label: "Cinza", hex: "#8a96a5" },
};

export const MOTIVO_LABEL: Record<MotivoEncerramento, string> = {
  sem_resposta: "Sem resposta",
  nao_deseja: "Não deseja visita",
  mudou_se: "Mudou-se",
  outro: "Outro motivo",
};

export const CANAL_LABEL: Record<CanalContato, string> = {
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  presencial: "Pessoalmente",
};

export const RESULTADO_LABEL: Record<ResultadoContato, string> = {
  conversou: "Conversou — quer receber a visita",
  nao_atendeu: "Não atendeu / sem resposta",
  nao_deseja: "Não deseja visita",
};

const TIPO_RANK: Record<EtapaTipo, number> = { inicial: 0, intermediaria: 1, concluida: 2, encerrada: 3 };

/** Ordena como o banco: inicial → intermediárias (ordem) → concluída → encerrada. */
export function ordenarEtapas<T extends Pick<EtapaInfo, "tipo" | "ordem" | "id">>(etapas: T[]): T[] {
  return [...etapas].sort((a, b) => TIPO_RANK[a.tipo] - TIPO_RANK[b.tipo] || a.ordem - b.ordem || a.id - b.id);
}

/**
 * Destinos permitidos a partir da etapa atual (espelha a função mover_etapa
 * do banco — que é quem de fato decide).
 */
export function destinosPermitidos(etapas: EtapaInfo[], atualId: number): EtapaInfo[] {
  const atual = etapas.find((e) => e.id === atualId);
  if (!atual) return [];
  const sequencia = ordenarEtapas(etapas.filter((e) => e.tipo !== "encerrada" && (e.ativo || e.id === atualId)));
  const encerrada = etapas.find((e) => e.tipo === "encerrada");
  const inicial = etapas.find((e) => e.tipo === "inicial");

  if (atual.tipo === "encerrada") return inicial ? [inicial] : [];

  const pos = sequencia.findIndex((e) => e.id === atualId);
  // "Visita agendada" só se alcança agendando (data, horário, endereço).
  const vizinhos = [sequencia[pos - 1], sequencia[pos + 1]].filter(
    (e): e is EtapaInfo => Boolean(e) && e!.ativo && e!.papel !== "visita_agendada",
  );
  const extras: EtapaInfo[] = [];
  if (atual.tipo === "concluida" && inicial && !vizinhos.some((v) => v.id === inicial.id)) extras.push(inicial);
  if (encerrada) extras.push(encerrada);
  return [...vizinhos, ...extras];
}

export function isAtrasado(desde: string, prazoHoras: number | null, agora = Date.now()) {
  if (!prazoHoras) return false;
  return agora - new Date(desde).getTime() > prazoHoras * 3_600_000;
}

/** "há 12 min", "há 3 h", "há 2 dias". */
export function tempoDesde(iso: string, agora = Date.now()) {
  const min = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

export function prazoLabel(horas: number | null) {
  if (!horas) return "Sem prazo";
  if (horas % 24 === 0) return horas === 24 ? "1 dia" : `${horas / 24} dias`;
  return `${horas} h`;
}

/**
 * Número no formato do WhatsApp (55 + DDD + celular), ou null se não for um
 * celular brasileiro (DDD + 9 dígitos começando com 9).
 */
export function numeroWhatsApp(numero: string): string | null {
  const d = numero.replace(/\D/g, "");
  if (/^[1-9]{2}9\d{8}$/.test(d)) return `55${d}`;
  if (/^55[1-9]{2}9\d{8}$/.test(d)) return d;
  return null;
}

export function renderMensagem(
  template: string,
  vars: { nome: string; gestor: string; igreja: string | null },
) {
  const primeiro = vars.nome.trim().split(/\s+/)[0] ?? vars.nome;
  return template
    .replaceAll("{primeiro_nome}", primeiro)
    .replaceAll("{nome}", vars.nome)
    .replaceAll("{gestor}", vars.gestor.split(" ")[0] ?? vars.gestor)
    .replaceAll("{igreja}", vars.igreja ?? "nossa igreja");
}

export function whatsappHref(numero: string, mensagem: string) {
  const n = numeroWhatsApp(numero);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(mensagem)}` : null;
}

export const SITUACAO_VISITA_LABEL: Record<SituacaoVisita, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  faltou: "Pessoa ausente",
  cancelada: "Cancelada",
};

const diaFmt = (tz: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });

/** Visita pendente cujo dia já passou sem registro do resultado. */
export function visitaAtrasada(agendadaPara: string, tz: string, agora = new Date()) {
  const f = diaFmt(tz);
  return f.format(new Date(agendadaPara)) < f.format(agora);
}

/** Link para abrir o endereço no aplicativo de mapas. */
export function mapsHref(endereco: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
}
