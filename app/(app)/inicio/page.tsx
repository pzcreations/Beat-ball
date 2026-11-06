import { ArrowRight, ClipboardList, Search, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PessoaList } from "@/components/pessoas/pessoa-list";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { countOwnSince, latestOwn } from "@/lib/data/pessoas";
import { startOfZonedDay } from "@/lib/dates";
import { env } from "@/lib/env";
import { formatInt } from "@/lib/format";

export const metadata: Metadata = { title: "Início" };

function saudacao(tz: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** Página inicial da recepção: ação principal em destaque e resumo do dia. */
export default async function InicioPage() {
  const user = await requireUser();
  if (user.role === "gestor") redirect("/gestor");

  const [hoje, recentes] = await Promise.all([
    countOwnSince(user.id, startOfZonedDay(env.timezone)),
    latestOwn(user.id, 5),
  ]);
  const firstName = user.fullName.split(" ")[0];

  return (
    <div className="grid gap-5 md:gap-6">
      <header className="animate-enter">
        <p className="text-sm text-muted">{saudacao(env.timezone)},</p>
        <h1 className="text-[22px] font-semibold tracking-tight text-navy-900 md:text-2xl">{firstName}</h1>
      </header>

      {/* Ação principal */}
      <Link
        href="/cadastrar"
        className="group flex animate-enter items-center gap-4 rounded-xl bg-navy-900 p-5 text-white shadow-sm transition-colors hover:bg-navy-800 active:scale-[0.995] md:p-6"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-white/10">
          <UserPlus className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold">Novo cadastro</span>
          <span className="block text-sm text-azure-200">Registrar nome e número de uma pessoa</span>
        </span>
        <ArrowRight className="size-5 shrink-0 text-azure-200 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>

      <div className="grid animate-enter grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[13px] text-muted">Seus cadastros hoje</p>
          <p className="mt-1 text-[28px] font-semibold leading-none text-navy-900 tabular">{formatInt(hoje)}</p>
        </Card>
        <Link href="/consulta" className="rounded-lg border border-line bg-white p-4 shadow-xs transition-colors hover:border-azure-300 hover:bg-azure-50">
          <Search className="size-5 text-navy-700" aria-hidden />
          <p className="mt-2 text-sm font-medium text-navy-900">Consultar registros</p>
          <p className="text-xs text-muted">{user.canViewRecords ? "Todos os cadastros" : "Seus cadastros"}</p>
        </Link>
      </div>

      <Card className="animate-enter overflow-hidden">
        <CardHeader
          title="Seus últimos cadastros"
          action={
            recentes.length > 0 ? (
              <ButtonLink href="/consulta" variant="ghost" size="sm">
                Ver todos
              </ButtonLink>
            ) : null
          }
        />
        {recentes.length === 0 ? (
          <EmptyState
            icon={<ClipboardList />}
            title="Nenhum cadastro ainda"
            description="Os cadastros que você realizar aparecerão aqui."
          />
        ) : (
          <PessoaList items={recentes.map((r) => ({ ...r, autor: null }))} />
        )}
      </Card>
    </div>
  );
}
