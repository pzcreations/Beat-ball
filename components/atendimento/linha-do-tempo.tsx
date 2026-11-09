import { ArrowRight, CalendarDays, MapPin, MessageCircle, PhoneCall, RotateCcw, UserPlus, Users } from "lucide-react";

import { EtapaBadge } from "@/components/atendimento/etapa-badge";
import { CANAL_LABEL, MOTIVO_LABEL, RESULTADO_LABEL, SITUACAO_VISITA_LABEL } from "@/lib/atendimento";
import type { EventoLinhaDoTempo } from "@/lib/data/funil";
import { formatRelative, formatVisita } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Linha do tempo do atendimento: cadastros, contatos e mudanças de etapa. */
export function LinhaDoTempo({ eventos }: { eventos: EventoLinhaDoTempo[] }) {
  if (eventos.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted md:px-5">Nenhum evento registrado.</p>;
  }

  return (
    <ol className="relative px-4 py-4 md:px-5">
      {eventos.map((e, i) => {
        const ultimo = i === eventos.length - 1;
        let Icon = ArrowRight;
        let titulo: React.ReactNode;
        let tom = "bg-azure-50 text-navy-700";

        if (e.tipo === "visita") {
          const v = e.visita;
          Icon = CalendarDays;
          tom =
            v.situacao === "realizada"
              ? "bg-success-bg text-success"
              : v.situacao === "agendada"
                ? "bg-azure-100 text-navy-800"
                : "bg-warning-bg text-warning";
          return (
            <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
              {!ultimo ? <span aria-hidden className="absolute left-4 top-9 bottom-0 w-px bg-line" /> : null}
              <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-full", tom)} aria-hidden>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-sm text-ink">
                  Visita para <span className="font-medium">{formatVisita(v.agendada_para)}</span>
                  <span className="ml-1.5 rounded-full bg-surface px-1.5 py-0.5 text-xs text-muted">
                    {SITUACAO_VISITA_LABEL[v.situacao]}
                  </span>
                </p>
                <p className="mt-0.5 flex items-start gap-1 text-[13px] text-muted">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>{v.endereco}</span>
                </p>
                {v.visitante ? <p className="text-[13px] text-muted">Visitante: {v.visitante.full_name}</p> : null}
                {v.observacao ? <p className="mt-1 rounded-md bg-surface px-3 py-2 text-[13px] text-ink">{v.observacao}</p> : null}
                {v.resultado_obs ? (
                  <p className="mt-1 rounded-md bg-surface px-3 py-2 text-[13px] text-ink">Resultado: {v.resultado_obs}</p>
                ) : null}
                <p className="mt-1 text-xs text-subtle">
                  Agendada {formatRelative(e.em).toLowerCase()}
                  {e.autor ? ` · ${e.autor}` : ""}
                </p>
              </div>
            </li>
          );
        }

        if (e.tipo === "contato") {
          Icon = e.canal === "whatsapp" ? MessageCircle : e.canal === "ligacao" ? PhoneCall : Users;
          tom = e.resultado === "conversou" ? "bg-success-bg text-success" : e.resultado === "nao_deseja" ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning";
          titulo = (
            <>
              Contato por {CANAL_LABEL[e.canal]}: <span className="font-medium">{RESULTADO_LABEL[e.resultado]}</span>
            </>
          );
        } else if (e.origem === "cadastro") {
          Icon = UserPlus;
          titulo = <>Cadastrado na recepção</>;
        } else if (e.origem === "recadastro") {
          Icon = RotateCcw;
          titulo =
            e.de && e.para && e.de.nome !== e.para.nome ? (
              <>Cadastrado novamente — atendimento reaberto</>
            ) : (
              <>Cadastrado novamente na recepção</>
            );
        } else {
          titulo = (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              Etapa alterada
              {e.de ? <EtapaBadge nome={e.de.nome} cor={e.de.cor} /> : null}
              <ArrowRight className="size-3.5 text-subtle" aria-label="para" />
              {e.para ? <EtapaBadge nome={e.para.nome} cor={e.para.cor} /> : null}
            </span>
          );
        }

        return (
          <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!ultimo ? <span aria-hidden className="absolute left-4 top-9 bottom-0 w-px bg-line" /> : null}
            <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-full", tom)} aria-hidden>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm text-ink">{titulo}</p>
              {e.tipo === "movimentacao" && e.motivo ? (
                <p className="mt-0.5 text-[13px] text-muted">Motivo: {MOTIVO_LABEL[e.motivo]}</p>
              ) : null}
              {e.observacao ? (
                <p className="mt-1 rounded-md bg-surface px-3 py-2 text-[13px] text-ink">{e.observacao}</p>
              ) : null}
              <p className="mt-1 text-xs text-subtle">
                {formatRelative(e.em)}
                {e.autor ? ` · ${e.autor}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
