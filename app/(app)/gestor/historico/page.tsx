import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { AuditTimeline, type AuditEntry } from "@/components/audit/audit-timeline";
import { Pagination } from "@/components/pagination";
import { Card, PageHeader } from "@/components/ui/card";
import { ConnectionError, requireGestor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Histórico" };

const PAGE = 30;

const TIPOS = {
  todos: { label: "Todos", entity: null },
  pessoa: { label: "Cadastros", entity: "pessoa" },
  usuario: { label: "Usuários", entity: "usuario" },
  sessao: { label: "Acessos", entity: "sessao" },
  exportacao: { label: "Exportações", entity: "exportacao" },
  configuracao: { label: "Configurações", entity: "configuracao" },
} as const;

const paramsSchema = z.object({
  tipo: z.enum(["todos", "pessoa", "usuario", "sessao", "exportacao", "configuracao"]).catch("todos"),
  pagina: z.coerce.number().int().min(1).max(10_000).catch(1),
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Histórico de atividades (trilha de auditoria imutável). */
export default async function HistoricoPage({ searchParams }: Props) {
  await requireGestor();
  const { tipo, pagina } = paramsSchema.parse(await searchParams);
  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("id, occurred_at, action, entity, entity_id, details, ator:profiles!audit_log_actor_id_fkey(full_name)", {
      count: "exact",
    })
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false });
  const entity = TIPOS[tipo].entity;
  if (entity) query = query.eq("entity", entity);

  const from = (pagina - 1) * PAGE;
  const { data, count, error } = await query.range(from, from + PAGE - 1);
  if (error && error.code !== "PGRST103") throw new ConnectionError();

  return (
    <div className="grid gap-5">
      <PageHeader title="Histórico de atividades" description="Registro de cadastros, alterações, acessos e exportações." />

      <nav aria-label="Tipo de evento" className="-mx-4 min-w-0 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-2">
          {Object.entries(TIPOS).map(([key, t]) => (
            <li key={key}>
              <Link
                href={key === "todos" ? "/gestor/historico" : `/gestor/historico?tipo=${key}`}
                aria-current={tipo === key ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors",
                  tipo === key
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-line bg-white text-muted hover:border-azure-300 hover:text-navy-900",
                )}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Card className="animate-enter overflow-hidden">
        <AuditTimeline entries={(data ?? []) as unknown as AuditEntry[]} />
        {(count ?? 0) > PAGE ? (
          <Pagination
            basePath="/gestor/historico"
            params={{ tipo: tipo === "todos" ? undefined : tipo }}
            page={pagina}
            pageSize={PAGE}
            total={count ?? 0}
          />
        ) : null}
      </Card>
    </div>
  );
}
