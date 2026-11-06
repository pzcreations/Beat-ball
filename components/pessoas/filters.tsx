import { Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { PERIODO_LABEL } from "@/lib/dates";
import type { Filtros } from "@/lib/validation";

type Props = {
  action: string;
  filtros: Filtros;
  /** Exibe período/ordem/responsável (gestor). */
  advanced?: boolean;
  responsaveis?: { id: string; full_name: string }[];
};

/**
 * Busca e filtros via GET (funcionam sem JavaScript e ficam na URL, o que
 * permite compartilhar/voltar). Os parâmetros são revalidados no servidor.
 */
export function PessoaFilters({ action, filtros, advanced, responsaveis = [] }: Props) {
  const hasFilters = Boolean(filtros.q || filtros.periodo || filtros.ordem || filtros.responsavel);

  return (
    <form action={action} method="get" role="search" className="grid gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-subtle" aria-hidden />
          <label htmlFor="q" className="sr-only">
            Buscar por nome ou número
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={filtros.q ?? ""}
            placeholder="Buscar por nome ou número"
            maxLength={120}
            autoComplete="off"
            enterKeyHint="search"
            className="pl-11"
          />
        </div>
        <Button type="submit" variant="primary" className="h-12 md:h-11">
          <span className="hidden sm:inline">Buscar</span>
          <Search className="sm:hidden" aria-label="Buscar" />
        </Button>
      </div>

      {advanced ? (
        <details className="group rounded-md md:open:block" open={Boolean(filtros.periodo || filtros.ordem || filtros.responsavel)}>
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-md text-sm font-medium text-navy-800 hover:text-navy-900 [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtros e ordenação
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <label htmlFor="periodo" className="text-xs font-medium text-muted">Período</label>
              <Select id="periodo" name="periodo" defaultValue={filtros.periodo ?? "todos"}>
                {Object.entries(PERIODO_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="ordem" className="text-xs font-medium text-muted">Ordenar por</label>
              <Select id="ordem" name="ordem" defaultValue={filtros.ordem ?? "recentes"}>
                <option value="recentes">Mais recentes</option>
                <option value="antigos">Mais antigos</option>
                <option value="nome">Nome (A–Z)</option>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="responsavel" className="text-xs font-medium text-muted">Responsável</label>
              <Select id="responsavel" name="responsavel" defaultValue={filtros.responsavel ?? ""}>
                <option value="">Todos</option>
                {responsaveis.map((r) => (
                  <option key={r.id} value={r.id}>{r.full_name}</option>
                ))}
              </Select>
            </div>
          </div>
        </details>
      ) : null}

      {hasFilters ? (
        <div>
          <Link href={action} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy-900">
            <X className="size-4" aria-hidden /> Limpar busca e filtros
          </Link>
        </div>
      ) : null}
    </form>
  );
}
