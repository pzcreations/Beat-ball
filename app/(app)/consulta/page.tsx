import { Info, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/pagination";
import { PessoaFilters } from "@/components/pessoas/filters";
import { PessoaList } from "@/components/pessoas/pessoa-list";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { PAGE_SIZE, listPessoas } from "@/lib/data/pessoas";
import { filtrosSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Consulta" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Consulta da recepção. O ESCOPO é definido pelo banco (RLS):
 * sem autorização do gestor, apenas os próprios cadastros são retornados.
 */
export default async function ConsultaPage({ searchParams }: Props) {
  const user = await requireUser();
  if (user.role === "gestor") redirect("/gestor/cadastros");

  const raw = await searchParams;
  const filtros = filtrosSchema.parse({ q: raw.q, pagina: raw.pagina });
  const { items, total, page } = await listPessoas(filtros, { withAuthor: false });

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Consulta"
        description={user.canViewRecords ? "Pesquise entre todos os cadastros." : "Pesquise entre os cadastros feitos por você."}
      />

      <PessoaFilters action="/consulta" filtros={filtros} />

      {!user.canViewRecords ? (
        <p className="flex items-start gap-2 text-[13px] text-muted">
          <Info className="mt-px size-4 shrink-0 text-navy-700" aria-hidden />
          Para consultar cadastros de outros atendentes, solicite autorização ao gestor.
        </p>
      ) : null}

      <Card className="animate-enter overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title={filtros.q ? "Nenhum resultado" : "Nenhum cadastro"}
            description={filtros.q ? "Revise o nome ou número pesquisado." : "Ainda não há cadastros disponíveis para consulta."}
          />
        ) : (
          <>
            <PessoaList items={items} />
            <Pagination basePath="/consulta" params={{ q: filtros.q }} page={page} pageSize={PAGE_SIZE} total={total} />
          </>
        )}
      </Card>
    </div>
  );
}
