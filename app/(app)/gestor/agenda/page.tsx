import { CalendarDays, Church, Clock, MapPin, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { WhatsAppLink } from "@/components/atendimento/acoes";
import { AgendarVisita, RegistrarVisita } from "@/components/atendimento/visita-dialogs";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { SITUACAO_VISITA_LABEL, mapsHref, whatsappHref } from "@/lib/atendimento";
import { requireGestor } from "@/lib/auth";
import { listAgenda, listGestores, listVisitasRegistradas, type VisitaAgenda } from "@/lib/data/funil";
import { startOfZonedDay } from "@/lib/dates";
import { env } from "@/lib/env";
import { formatHora, formatVisita } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Agenda" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const DIAS_A_FRENTE = 30;

const tituloDia = new Intl.DateTimeFormat("pt-BR", {
  timeZone: env.timezone,
  weekday: "long",
  day: "2-digit",
  month: "long",
});

function mensagemConfirmacao(v: VisitaAgenda) {
  const primeiro = v.pessoa!.nome.split(" ")[0];
  return `Olá, ${primeiro}! Graça e paz. Passando para confirmar a visita pastoral marcada para ${formatVisita(v.agendada_para)}. Até lá!`;
}

/** Agenda de visitas: atrasadas, hoje, amanhã e próximos dias. */
export default async function AgendaPage({ searchParams }: Props) {
  const gestor = await requireGestor();
  const raw = await searchParams;
  const minhas = raw.minhas === "1";
  const tz = env.timezone;

  const inicioHoje = startOfZonedDay(tz, 0);
  const inicioAmanha = startOfZonedDay(tz, -1);
  const inicioDepois = startOfZonedDay(tz, -2);
  const limite = startOfZonedDay(tz, -(DIAS_A_FRENTE + 1));

  const [visitas, registradas, gestores] = await Promise.all([
    listAgenda(limite, minhas ? gestor.id : undefined),
    listVisitasRegistradas(10, minhas ? gestor.id : undefined),
    listGestores(),
  ]);

  const atrasadas = visitas.filter((v) => new Date(v.agendada_para) < inicioHoje);
  const hoje = visitas.filter((v) => new Date(v.agendada_para) >= inicioHoje && new Date(v.agendada_para) < inicioAmanha);
  const amanha = visitas.filter((v) => new Date(v.agendada_para) >= inicioAmanha && new Date(v.agendada_para) < inicioDepois);
  const proximas = visitas.filter((v) => new Date(v.agendada_para) >= inicioDepois);

  // Próximas visitas agrupadas por dia.
  const porDia = new Map<string, VisitaAgenda[]>();
  for (const v of proximas) {
    const k = tituloDia.format(new Date(v.agendada_para));
    porDia.set(k, [...(porDia.get(k) ?? []), v]);
  }

  const grupo = (titulo: string, itens: VisitaAgenda[], destaque?: "atraso" | "hoje") =>
    itens.length === 0 ? null : (
      <section key={titulo} className="grid gap-2.5">
        <h2
          className={cn(
            "flex items-center gap-2 text-sm font-semibold first-letter:uppercase",
            destaque === "atraso" ? "text-danger" : "text-navy-900",
          )}
        >
          {titulo}
          <span className="rounded-full bg-surface px-1.5 text-xs font-medium text-muted">{itens.length}</span>
        </h2>
        <div className="grid gap-2.5 md:grid-cols-2">
          {itens.map((v) => (
            <ItemVisita key={v.id} v={v} destaque={destaque} gestores={gestores} gestorId={gestor.id} />
          ))}
        </div>
      </section>
    );

  return (
    <div className="grid gap-6">
      <PageHeader title="Agenda de visitas" description={`Próximos ${DIAS_A_FRENTE} dias e visitas sem registro.`} />

      <nav aria-label="Filtro" className="flex gap-2">
        {[
          { href: "/gestor/agenda", label: "Todas", ativo: !minhas },
          { href: "/gestor/agenda?minhas=1", label: "Minhas visitas", ativo: minhas },
        ].map((f) => (
          <Link
            key={f.href}
            href={f.href}
            aria-current={f.ativo ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors",
              f.ativo ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white text-muted hover:text-navy-900",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {visitas.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays />}
            title="Nenhuma visita agendada"
            description="Agende visitas pelos cartões em Atendimentos ou pela ficha da pessoa."
          />
        </Card>
      ) : (
        <>
          {grupo("Sem registro do resultado", atrasadas, "atraso")}
          {grupo("Hoje", hoje, "hoje")}
          {grupo("Amanhã", amanha)}
          {[...porDia.entries()].map(([dia, itens]) => grupo(dia, itens))}
        </>
      )}

      {registradas.length > 0 ? (
        <Card className="animate-enter">
          <div className="border-b border-line px-4 py-3.5 md:px-5">
            <h2 className="text-[15px] font-semibold text-navy-900">Registradas recentemente</h2>
          </div>
          <ul className="divide-y divide-line">
            {registradas.map((v) => (
              <li key={v.id}>
                <Link href={`/gestor/cadastros/${v.pessoa!.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-azure-50/60 md:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-navy-900">{v.pessoa!.nome}</p>
                    <p className="truncate text-xs text-muted">
                      {formatVisita(v.agendada_para)} · {v.visitante?.full_name ?? "—"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      v.situacao === "realizada" ? "bg-success-bg text-success" : "bg-warning-bg text-warning",
                    )}
                  >
                    {SITUACAO_VISITA_LABEL[v.situacao]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function ItemVisita({
  v,
  destaque,
  gestores,
  gestorId,
}: {
  v: VisitaAgenda;
  destaque?: "atraso" | "hoje";
  gestores: { id: string; full_name: string }[];
  gestorId: string;
}) {
  const pessoa = v.pessoa!;
  const wa = whatsappHref(pessoa.numero, mensagemConfirmacao(v));
  return (
    <article
      className={cn(
        "rounded-lg border bg-white p-4",
        destaque === "atraso" ? "border-[#f3c4bf]" : destaque === "hoje" ? "border-azure-300" : "border-line",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid w-16 shrink-0 place-items-center rounded-md py-2 text-center",
            destaque === "atraso" ? "bg-danger-bg text-danger" : "bg-azure-50 text-navy-800",
          )}
        >
          <Clock className="mb-0.5 size-3.5" aria-hidden />
          <span className="text-[15px] font-semibold tabular">{formatHora(v.agendada_para)}</span>
          {destaque === "atraso" ? <span className="text-[10px]">{formatVisita(v.agendada_para).split(" ")[1]}</span> : null}
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/gestor/cadastros/${pessoa.id}`} className="font-medium text-navy-900 hover:underline">
            {pessoa.nome}
          </Link>
          <a
            href={mapsHref(v.endereco)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-start gap-1.5 text-[13px] text-navy-700 hover:underline"
          >
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{v.endereco}</span>
          </a>
          <div className="mt-1 grid gap-0.5 text-xs text-muted">
            {pessoa.igreja ? (
              <p className="flex items-center gap-1.5">
                <Church className="size-3.5 shrink-0 text-subtle" aria-hidden />
                {pessoa.igreja.nome}
              </p>
            ) : null}
            <p className="flex items-center gap-1.5">
              <UserRound className="size-3.5 shrink-0 text-subtle" aria-hidden />
              {v.visitante?.full_name ?? "—"}
            </p>
          </div>
          {v.observacao ? <p className="mt-2 rounded-md bg-surface px-2.5 py-1.5 text-xs text-ink">{v.observacao}</p> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {wa ? <WhatsAppLink href={wa} compact /> : null}
        <RegistrarVisita visitaId={v.id} pessoaNome={pessoa.nome} agendadaPara={v.agendada_para} variant="primary" />
        <AgendarVisita
          pessoaId={pessoa.id}
          pessoaNome={pessoa.nome}
          visita={v}
          gestores={gestores}
          visitantePadrao={gestorId}
          variant="outline"
          compact
        />
      </div>
    </article>
  );
}

