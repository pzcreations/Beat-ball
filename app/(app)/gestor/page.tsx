import { CalendarCheck2, CalendarDays, CalendarRange, MapPin, ChevronRight, CircleCheck, ClipboardList, History, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { BarChart } from "@/components/charts/bar-chart";
import { PessoaList } from "@/components/pessoas/pessoa-list";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { ConnectionError, requireGestor } from "@/lib/auth";
import { getFunil, listAgenda, listAtrasados, listEtapas } from "@/lib/data/funil";
import { startOfZonedDay } from "@/lib/dates";
import { listPessoas } from "@/lib/data/pessoas";
import { ETAPA_COR, mapsHref, tempoDesde } from "@/lib/atendimento";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";
import { formatHora, formatInt, formatVisita } from "@/lib/format";
import { ConviteNotificacoes } from "@/components/notificacoes/ativar";
import { getVapidPublicKey } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Painel" };

type Stats = {
  total: number;
  hoje: number;
  ultimos_7_dias: number;
  mes: number;
  serie: { dia: string; total: number }[];
  por_usuario_mes: { nome: string; total: number }[];
};

function StatCard({ label, value, icon: Icon, highlight }: { label: string; value: number; icon: typeof Users; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-navy-900 bg-navy-900 p-4 text-white md:p-5" : "p-4 md:p-5"}>
      <div className="flex items-center justify-between">
        <p className={highlight ? "text-[13px] text-azure-200" : "text-[13px] text-muted"}>{label}</p>
        <Icon className={highlight ? "size-4 text-azure-200" : "size-4 text-subtle"} aria-hidden />
      </div>
      <p className={`mt-2 text-[28px] font-semibold leading-none tabular md:text-[32px] ${highlight ? "text-white" : "text-navy-900"}`}>
        {formatInt(value)}
      </p>
    </Card>
  );
}

/** Painel do gestor — todos os números vêm do banco (função dashboard_stats). */
export default async function GestorDashboard() {
  const user = await requireGestor();
  const supabase = await createClient();

  const [statsRes, recentes, funil, etapas] = await Promise.all([
    supabase.rpc("dashboard_stats", { p_tz: env.timezone }),
    listPessoas({ pagina: 1 }, { withAuthor: true }),
    getFunil(),
    listEtapas(),
  ]);
  const [atrasados, visitasHoje] = await Promise.all([
    listAtrasados(etapas),
    listAgenda(startOfZonedDay(env.timezone, -1)),
  ]);
  const inicioHoje = startOfZonedDay(env.timezone, 0);
  const publicKey = await getVapidPublicKey().catch(() => null);
  const totalAtrasados = funil.reduce((s, f) => s + f.atrasados, 0);
  const funilAberto = funil.filter((f) => f.tipo !== "encerrada");
  const maxFunil = Math.max(1, ...funilAberto.map((f) => f.total));
  if (statsRes.error) throw new ConnectionError();
  const stats = statsRes.data as unknown as Stats;
  const ultimos = recentes.items.slice(0, 6);
  const maxUser = Math.max(1, ...stats.por_usuario_mes.map((u) => u.total));

  return (
    <div className="grid gap-5 md:gap-6">
      <PageHeader
        title="Painel"
        description={`Olá, ${user.fullName.split(" ")[0]}. Acompanhe os cadastros da recepção.`}
        action={
          <ButtonLink href="/cadastrar" className="hidden md:inline-flex">
            <UserPlus aria-hidden /> Novo cadastro
          </ButtonLink>
        }
      />

      {publicKey ? <ConviteNotificacoes publicKey={publicKey} /> : null}

      <section aria-label="Indicadores" className="grid animate-enter grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Total de pessoas" value={stats.total} icon={Users} highlight />
        <StatCard label="Hoje" value={stats.hoje} icon={CalendarDays} />
        <StatCard label="Últimos 7 dias" value={stats.ultimos_7_dias} icon={CalendarRange} />
        <StatCard label="Neste mês" value={stats.mes} icon={CalendarRange} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6">
        <Card className="animate-enter">
          <CardHeader
            title="Acompanhamento pastoral"
            description="Pessoas em cada etapa"
            action={
              <ButtonLink href="/gestor/atendimentos" variant="ghost" size="sm">
                Abrir
              </ButtonLink>
            }
          />
          <ul className="grid gap-1 p-2 md:p-3">
            {funil.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/gestor/atendimentos?etapa=${f.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-md px-2 py-2 hover:bg-azure-50/70"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm text-navy-900">
                    <span className={cn("size-2.5 shrink-0 rounded-full", ETAPA_COR[f.cor].dot)} aria-hidden />
                    <span className="truncate">{f.nome}</span>
                    {f.atrasados > 0 ? (
                      <span className="shrink-0 rounded-full bg-danger-bg px-1.5 text-xs font-medium text-danger">
                        {f.atrasados} atrasado{f.atrasados > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-sm font-semibold text-navy-900 tabular">{formatInt(f.total)}</span>
                  {f.tipo !== "encerrada" ? (
                    <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="col-span-2 h-1.5 w-full" aria-hidden>
                      <rect width="100" height="4" rx="2" fill="#eef3f9" />
                      <rect width={(f.total / maxFunil) * 100} height="4" rx="2" fill={ETAPA_COR[f.cor].hex} />
                    </svg>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="animate-enter">
          <CardHeader
            title="Precisam de atenção"
            description={totalAtrasados > 0 ? `${formatInt(totalAtrasados)} pessoa(s) com prazo vencido` : "Prazos em dia"}
          />
          {atrasados.length === 0 ? (
            <EmptyState icon={<CircleCheck />} title="Nenhum atendimento atrasado" description="Todos os contatos e agendamentos estão dentro do prazo." />
          ) : (
            <ul className="divide-y divide-line">
              {atrasados.map((a) => (
                <li key={a.pessoa_id}>
                  <Link href={`/gestor/cadastros/${a.pessoa_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-azure-50/60 md:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy-900">{a.pessoa!.nome}</p>
                      <p className="truncate text-xs text-muted">
                        {a.etapa.nome} · <span className="text-danger">{tempoDesde(a.etapa_desde)}</span>
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="animate-enter">
        <CardHeader
          title="Visitas de hoje"
          description={visitasHoje.length > 0 ? "Inclui visitas anteriores ainda sem registro" : undefined}
          action={
            <ButtonLink href="/gestor/agenda" variant="ghost" size="sm">
              Agenda
            </ButtonLink>
          }
        />
        {visitasHoje.length === 0 ? (
          <EmptyState icon={<CalendarCheck2 />} title="Nenhuma visita para hoje" />
        ) : (
          <ul className="divide-y divide-line">
            {visitasHoje.map((v) => {
              const atrasada = new Date(v.agendada_para) < inicioHoje;
              return (
                <li key={v.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                  <span
                    className={cn(
                      "w-14 shrink-0 rounded-md py-1.5 text-center text-sm font-semibold tabular",
                      atrasada ? "bg-danger-bg text-danger" : "bg-azure-50 text-navy-800",
                    )}
                  >
                    {atrasada ? formatVisita(v.agendada_para).split(" ")[1] : formatHora(v.agendada_para)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/gestor/cadastros/${v.pessoa!.id}`} className="block truncate text-sm font-medium text-navy-900 hover:underline">
                      {v.pessoa!.nome}
                    </Link>
                    <a
                      href={mapsHref(v.endereco)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 truncate text-xs text-muted hover:underline"
                    >
                      <MapPin className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{v.endereco}</span>
                    </a>
                  </div>
                  <span className="hidden shrink-0 text-xs text-muted sm:block">{v.visitante?.full_name}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6">
        <Card className="animate-enter">
          <CardHeader title="Evolução dos cadastros" description="Últimos 30 dias" />
          <div className="px-3 pb-3 pt-4 md:px-5 md:pb-5">
            <BarChart data={stats.serie} />
          </div>
        </Card>

        <Card className="animate-enter">
          <CardHeader title="Cadastros por atendente" description="Neste mês" />
          {stats.por_usuario_mes.length === 0 ? (
            <EmptyState icon={<Users />} title="Sem cadastros neste mês" />
          ) : (
            <ul className="grid gap-3.5 p-4 md:p-5">
              {stats.por_usuario_mes.map((u) => (
                <li key={u.nome}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-navy-900">{u.nome}</span>
                    <span className="font-medium text-navy-900 tabular">{formatInt(u.total)}</span>
                  </div>
                  <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="mt-1.5 h-1.5 w-full" aria-hidden>
                    <rect width="100" height="4" rx="2" fill="#e5effa" />
                    <rect width={(u.total / maxUser) * 100} height="4" rx="2" fill="#1c4a80" />
                  </svg>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="animate-enter overflow-hidden">
        <CardHeader
          title="Últimos registros"
          action={
            <div className="flex gap-1">
              <ButtonLink href="/gestor/historico" variant="ghost" size="sm">
                <History aria-hidden /> <span className="hidden sm:inline">Histórico</span>
              </ButtonLink>
              <ButtonLink href="/gestor/cadastros" variant="ghost" size="sm">
                Ver todos
              </ButtonLink>
            </div>
          }
        />
        {ultimos.length === 0 ? (
          <EmptyState
            icon={<ClipboardList />}
            title="Nenhum cadastro ainda"
            description="Os registros feitos pela recepção aparecerão aqui."
          />
        ) : (
          <PessoaList items={ultimos} showAuthor hrefFor={(id) => `/gestor/cadastros/${id}`} />
        )}
      </Card>
    </div>
  );
}
