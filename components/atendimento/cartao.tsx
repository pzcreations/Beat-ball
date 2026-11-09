import { CalendarDays, Church, MapPin, Phone, RotateCcw } from "lucide-react";
import Link from "next/link";

import { MudarEtapa, RegistrarContato, WhatsAppLink } from "@/components/atendimento/acoes";
import { AgendarVisita, RegistrarVisita } from "@/components/atendimento/visita-dialogs";
import {
  destinosPermitidos,
  isAtrasado,
  mapsHref,
  renderMensagem,
  tempoDesde,
  visitaAtrasada,
  whatsappHref,
  type EtapaInfo,
} from "@/lib/atendimento";
import type { CartaoAtendimento, Visita } from "@/lib/data/funil";
import { formatNumero, formatVisita } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ContextoCartao = {
  etapas: EtapaInfo[];
  mensagem: string;
  gestor: { id: string; nome: string };
  gestores: { id: string; full_name: string }[];
  timezone: string;
};

type Props = {
  cartao: CartaoAtendimento;
  etapa: EtapaInfo;
  visita?: Visita | null;
  ctx: ContextoCartao;
  /** Versão compacta para o quadro Kanban. */
  compacto?: boolean;
};

/** Cartão de uma pessoa no funil, com as ações do gestor para a etapa. */
export function CartaoPessoa({ cartao, etapa, visita, ctx, compacto }: Props) {
  const pessoa = cartao.pessoa!;
  const aberto = etapa.tipo !== "concluida" && etapa.tipo !== "encerrada";
  const atrasado = visita
    ? visitaAtrasada(visita.agendada_para, ctx.timezone)
    : isAtrasado(cartao.etapa_desde, etapa.prazo_horas);
  const wa = aberto
    ? whatsappHref(
        pessoa.numero,
        renderMensagem(ctx.mensagem, { nome: pessoa.nome, gestor: ctx.gestor.nome, igreja: pessoa.igreja?.nome ?? null }),
      )
    : null;
  const destinos = destinosPermitidos(ctx.etapas, etapa.id);
  const size = compacto ? "sm" : "md";

  // Ação principal conforme a etapa.
  const podeAgendar = aberto && !visita && (etapa.papel === "agendamento" || etapa.papel === "visita_realizada");
  const podeContatar = aberto && !visita && etapa.papel !== "visita_realizada";

  return (
    <article className={cn("rounded-lg border bg-white", atrasado ? "border-[#f3c4bf]" : "border-line", compacto ? "p-3" : "p-4")}>
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/gestor/cadastros/${pessoa.id}`}
          className={cn("min-w-0 font-medium text-navy-900 hover:underline", compacto ? "text-sm" : "text-[15px]")}
        >
          <span className="line-clamp-2">{pessoa.nome}</span>
        </Link>
        {!visita ? (
          <span
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
              atrasado ? "bg-danger-bg text-danger" : "bg-surface text-muted",
            )}
            title={atrasado ? "Prazo desta etapa ultrapassado" : "Tempo nesta etapa"}
          >
            {atrasado ? "Atrasado · " : ""}
            {tempoDesde(cartao.etapa_desde)}
          </span>
        ) : null}
      </div>

      {visita ? (
        <div
          className={cn(
            "mt-2 grid gap-0.5 rounded-md px-2.5 py-2",
            atrasado ? "bg-danger-bg text-danger" : "bg-azure-50 text-navy-800",
            compacto ? "text-xs" : "text-[13px]",
          )}
        >
          <p className="flex items-center gap-1.5 font-medium">
            <CalendarDays className="size-3.5 shrink-0" aria-hidden />
            {formatVisita(visita.agendada_para)}
            {atrasado ? " · sem registro" : ""}
          </p>
          <a
            href={mapsHref(visita.endereco)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-1.5 hover:underline"
          >
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">{visita.endereco}</span>
          </a>
          {visita.visitante ? <p className="pl-5 opacity-80">{visita.visitante.full_name}</p> : null}
        </div>
      ) : null}

      <div className={cn("mt-1.5 grid gap-0.5 text-muted", compacto ? "text-xs" : "text-[13px]")}>
        {pessoa.igreja ? (
          <p className="flex items-center gap-1.5 truncate">
            <Church className="size-3.5 shrink-0 text-subtle" aria-hidden />
            <span className="truncate">{pessoa.igreja.nome.replace(/^Igreja Adventista /i, "IASD ")}</span>
          </p>
        ) : null}
        <p className="flex items-center gap-1.5 tabular">
          <Phone className="size-3.5 shrink-0 text-subtle" aria-hidden />
          {formatNumero(pessoa.numero)}
        </p>
        {cartao.tentativas_contato > 0 ? (
          <p className="flex items-center gap-1.5 text-warning">
            <RotateCcw className="size-3.5 shrink-0" aria-hidden />
            {cartao.tentativas_contato} tentativa(s) sem resposta
          </p>
        ) : null}
      </div>

      <div className={cn("flex gap-2 [&>*:nth-child(2)]:min-w-0", compacto ? "mt-2.5" : "mt-3.5")}>
        {wa ? <WhatsAppLink href={wa} compact size={size} /> : null}
        {visita ? (
          <>
            <RegistrarVisita
              visitaId={visita.id}
              pessoaNome={pessoa.nome}
              agendadaPara={visita.agendada_para}
              label="Registrar"
              variant="primary"
              size={size}
              compact={compacto}
              block={!compacto}
            />
            <AgendarVisita
              pessoaId={pessoa.id}
              pessoaNome={pessoa.nome}
              visita={visita}
              gestores={ctx.gestores}
              visitantePadrao={ctx.gestor.id}
              variant="outline"
              size={size}
              compact
            />
          </>
        ) : null}
        {podeAgendar ? (
          <AgendarVisita
            pessoaId={pessoa.id}
            pessoaNome={pessoa.nome}
            gestores={ctx.gestores}
            visitantePadrao={ctx.gestor.id}
            triggerLabel={etapa.papel === "visita_realizada" ? "Nova visita" : "Agendar visita"}
            variant={etapa.papel === "agendamento" ? "primary" : "outline"}
            size={size}
            compact={compacto}
            block={!compacto}
          />
        ) : null}
        {podeContatar ? (
          <RegistrarContato
            pessoaId={pessoa.id}
            pessoaNome={pessoa.nome}
            compact={compacto || etapa.papel === "agendamento"}
            size={size}
          />
        ) : null}
        <MudarEtapa
          pessoaId={pessoa.id}
          pessoaNome={pessoa.nome}
          destinos={destinos}
          atualTipo={etapa.tipo}
          compact
          size={size}
          triggerLabel={aberto ? "Mudar etapa" : "Reabrir ou mudar etapa"}
        />
      </div>
    </article>
  );
}
