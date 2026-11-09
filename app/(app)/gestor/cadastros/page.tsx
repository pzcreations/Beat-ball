import { Download, SearchX, UserPlus } from "lucide-react";
import type { Metadata } from "next";

import { FlashToast } from "@/components/flash-toast";
import { Pagination, buildHref } from "@/components/pagination";
import { PessoaFilters } from "@/components/pessoas/filters";
import { PessoaList } from "@/components/pessoas/pessoa-list";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { ConnectionError, requireGestor } from "@/lib/auth";
import { listEtapas, listIgrejas } from "@/lib/data/funil";
import { PAGE_SIZE, listPessoas } from "@/lib/data/pessoas";
import { formatInt } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { filtrosSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Cadastros" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Gerenciamento de cadastros: busca, filtros, ordenação, edição e exportação. */
export default async function CadastrosPage({ searchParams }: Props) {
  await requireGestor();
  const raw = await searchParams;
  const filtros = filtrosSchema.parse({
    q: raw.q,
    periodo: raw.periodo === "todos" ? undefined : raw.periodo,
    ordem: raw.ordem === "recentes" ? undefined : raw.ordem,
    pagina: raw.pagina,
    responsavel: raw.responsavel || undefined,
    igreja: raw.igreja || undefined,
    etapa: raw.etapa || undefined,
  });

  const supabase = await createClient();
  const [lista, usuarios, igrejas, etapas] = await Promise.all([
    listPessoas(filtros, { withAuthor: true }),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    listIgrejas(true),
    listEtapas(true),
  ]);
  if (usuarios.error) throw new ConnectionError();

  const params = {
    q: filtros.q,
    periodo: filtros.periodo,
    ordem: filtros.ordem,
    responsavel: filtros.responsavel,
    igreja: filtros.igreja,
    etapa: filtros.etapa,
  };
  const exportHref = buildHref("/gestor/exportar", params);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Cadastros"
        description={`${formatInt(lista.total)} registro(s) encontrado(s).`}
        action={
          <>
            <ButtonLink href={exportHref} variant="outline" prefetch={false} aria-label="Exportar CSV">
              <Download aria-hidden /> <span className="hidden sm:inline">Exportar</span>
            </ButtonLink>
            <ButtonLink href="/cadastrar">
              <UserPlus aria-hidden /> <span className="hidden sm:inline">Novo</span>
            </ButtonLink>
          </>
        }
      />

      <PessoaFilters action="/gestor/cadastros" filtros={filtros} advanced
        responsaveis={usuarios.data ?? []}
        igrejas={igrejas}
        etapas={etapas}
      />

      <Card className="animate-enter overflow-hidden">
        {lista.items.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title="Nenhum cadastro encontrado"
            description="Ajuste a busca ou os filtros aplicados."
          />
        ) : (
          <>
            <PessoaList items={lista.items} showAuthor hrefFor={(id) => `/gestor/cadastros/${id}`} />
            <Pagination basePath="/gestor/cadastros" params={params} page={lista.page} pageSize={PAGE_SIZE} total={lista.total} />
          </>
        )}
      </Card>

      <FlashToast msg={typeof raw.msg === "string" ? raw.msg : undefined} />
    </div>
  );
}
