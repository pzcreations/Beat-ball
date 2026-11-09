import { ArrowRightLeft, CalendarCheck, CalendarClock, CalendarPlus, Download, KeyRound, LogIn, LogOut, MessageCircle, Pencil, RotateCcw, Settings, ShieldCheck, Trash2, UserCog, UserPlus } from "lucide-react";

import type { AuditAction, Json } from "@/lib/database.types";
import { formatNumero, formatRelative, formatVisita, ROLE_LABEL } from "@/lib/format";

export type AuditEntry = {
  id: number;
  occurred_at: string;
  action: AuditAction;
  entity: string;
  entity_id: string | null;
  details: Json;
  ator: { full_name: string } | null;
};

type Obj = Record<string, Json | undefined>;
const obj = (v: Json | undefined): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: Json | undefined) => (typeof v === "string" ? v : v === null || v === undefined ? "—" : String(v));

const ICON = {
  "pessoa.criada": UserPlus,
  "pessoa.editada": Pencil,
  "pessoa.excluida": Trash2,
  "usuario.criado": ShieldCheck,
  "usuario.editado": UserCog,
  "usuario.senha_redefinida": KeyRound,
  "sessao.login": LogIn,
  "sessao.logout": LogOut,
  "dados.exportados": Download,
  "pessoa.etapa_alterada": ArrowRightLeft,
  "pessoa.contato_registrado": MessageCircle,
  "pessoa.recadastrada": RotateCcw,
  "config.alterada": Settings,
  "visita.agendada": CalendarPlus,
  "visita.reagendada": CalendarClock,
  "visita.registrada": CalendarCheck,
} as const satisfies Record<AuditAction, unknown>;

const CANAL: Record<string, string> = { whatsapp: "WhatsApp", ligacao: "ligação", presencial: "pessoalmente" };
const RESULTADO: Record<string, string> = {
  conversou: "conversou e quer a visita",
  nao_atendeu: "não atendeu",
  nao_deseja: "não deseja visita",
};
const SITUACAO: Record<string, string> = { realizada: "Realizada", faltou: "Pessoa ausente", cancelada: "Cancelada" };
const quando = (v: Json | undefined) => (typeof v === "string" ? formatVisita(v) : "—");

const TABELA: Record<string, string> = {
  etapas: "as etapas do funil",
  igrejas: "as igrejas",
  configuracoes: "a mensagem do WhatsApp",
};

const FIELD_LABEL: Record<string, string> = {
  nome: "Nome",
  perfil: "Perfil",
  pode_consultar: "Pode consultar todos",
  ativo: "Acesso ativo",
  igreja: "Igreja",
};

function fmtValue(key: string, v: Json | undefined) {
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (key === "perfil" && (v === "gestor" || v === "recepcao")) return ROLE_LABEL[v];
  if (key === "numero" && typeof v === "string") return formatNumero(v);
  return str(v);
}

/** Traduz um evento de auditoria para texto legível. */
function describe(e: AuditEntry): { title: string; changes: string[] } {
  const d = obj(e.details);
  const antes = obj(d.antes);
  const depois = obj(d.depois);
  switch (e.action) {
    case "pessoa.criada":
      return { title: `cadastrou ${str(depois.nome)}`, changes: [`Número: ${fmtValue("numero", depois.numero)}`] };
    case "pessoa.editada": {
      const changes: string[] = [];
      if (antes.nome !== depois.nome) changes.push(`Nome: ${str(antes.nome)} → ${str(depois.nome)}`);
      if (antes.numero !== depois.numero)
        changes.push(`Número: ${fmtValue("numero", antes.numero)} → ${fmtValue("numero", depois.numero)}`);
      if (antes.igreja !== depois.igreja) changes.push(`Igreja: ${str(antes.igreja)} → ${str(depois.igreja)}`);
      return { title: `editou o cadastro de ${str(depois.nome)}`, changes };
    }
    case "pessoa.excluida":
      return { title: `excluiu o cadastro de ${str(antes.nome)}`, changes: [`Número: ${fmtValue("numero", antes.numero)}`] };
    case "usuario.criado":
      return {
        title: `criou o usuário ${str(d.nome)}`,
        changes: [`Perfil: ${fmtValue("perfil", d.perfil)}`, `Acesso ativo: ${fmtValue("ativo", d.ativo)}`],
      };
    case "usuario.editado": {
      const alt = obj(d.alteracoes);
      const changes = Object.entries(alt).map(([k, v]) => {
        const c = obj(v);
        return `${FIELD_LABEL[k] ?? k}: ${fmtValue(k, c.antes)} → ${fmtValue(k, c.depois)}`;
      });
      return { title: `alterou o usuário ${str(d.email)}`, changes };
    }
    case "usuario.senha_redefinida":
      return { title: "redefiniu a senha de um usuário", changes: [] };
    case "sessao.login":
      return { title: "entrou no sistema", changes: [] };
    case "sessao.logout":
      return { title: "saiu do sistema", changes: [] };
    case "pessoa.etapa_alterada":
      return {
        title: `moveu ${str(d.nome)} de etapa`,
        changes: [`${str(d.de)} → ${str(d.para)}`],
      };
    case "pessoa.contato_registrado":
      return {
        title: `registrou contato com ${str(d.nome)}`,
        changes: [`Por ${CANAL[str(d.canal)] ?? str(d.canal)}: ${RESULTADO[str(d.resultado)] ?? str(d.resultado)}`],
      };
    case "pessoa.recadastrada":
      return { title: `cadastrou novamente ${str(d.nome)}`, changes: [] };
    case "visita.agendada":
      return {
        title: `agendou visita para ${str(d.nome)}`,
        changes: [`${quando(d.quando)}${d.visitante ? ` · ${str(d.visitante)}` : ""}`],
      };
    case "visita.reagendada":
      return {
        title: `reagendou a visita de ${str(d.nome)}`,
        changes: [`${quando(d.antes)} → ${quando(d.depois)}`],
      };
    case "visita.registrada":
      return {
        title: `registrou a visita de ${str(d.nome)}`,
        changes: [`${SITUACAO[str(d.situacao)] ?? str(d.situacao)} (${quando(d.quando)})`],
      };
    case "config.alterada":
      return {
        title: `alterou ${TABELA[str(d.tabela)] ?? "as configurações"}`,
        changes: d.nome ? [str(d.nome)] : [],
      };
    case "dados.exportados":
      return { title: `exportou ${str(d.linhas)} registro(s) em CSV`, changes: [] };
    default:
      return { title: e.action, changes: [] };
  }
}

export function AuditTimeline({ entries, compact }: { entries: AuditEntry[]; compact?: boolean }) {
  if (entries.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted md:px-5">Nenhum evento registrado.</p>;
  }
  return (
    <ol className="divide-y divide-line">
      {entries.map((e) => {
        const Icon = ICON[e.action] ?? Pencil;
        const { title, changes } = describe(e);
        const danger = e.action === "pessoa.excluida";
        return (
          <li key={e.id} className={`flex gap-3 px-4 md:px-5 ${compact ? "py-3" : "py-3.5"}`}>
            <span
              className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${danger ? "bg-danger-bg text-danger" : "bg-azure-50 text-navy-700"}`}
              aria-hidden
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                <span className="font-medium text-navy-900">{e.ator?.full_name ?? "Sistema"}</span> {title}
              </p>
              {changes.length > 0 ? (
                <ul className="mt-1 grid gap-0.5">
                  {changes.map((c) => (
                    <li key={c} className="break-words text-[13px] text-muted">
                      {c}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-1 text-xs text-subtle">{formatRelative(e.occurred_at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
