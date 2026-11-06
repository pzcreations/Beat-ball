import { CalendarDays, CalendarRange, ClipboardList, History, UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";

import { BarChart } from "@/components/charts/bar-chart";
import { PessoaList } from "@/components/pessoas/pessoa-list";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { ConnectionError, requireGestor } from "@/lib/auth";
import { listPessoas } from "@/lib/data/pessoas";
import { env } from "@/lib/env";
import { formatInt } from "@/lib/format";
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

  const [statsRes, recentes] = await Promise.all([
    supabase.rpc("dashboard_stats", { p_tz: env.timezone }),
    listPessoas({ pagina: 1 }, { withAuthor: true }),
  ]);
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

      <section aria-label="Indicadores" className="grid animate-enter grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Total de pessoas" value={stats.total} icon={Users} highlight />
        <StatCard label="Hoje" value={stats.hoje} icon={CalendarDays} />
        <StatCard label="Últimos 7 dias" value={stats.ultimos_7_dias} icon={CalendarRange} />
        <StatCard label="Neste mês" value={stats.mes} icon={CalendarRange} />
      </section>

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
