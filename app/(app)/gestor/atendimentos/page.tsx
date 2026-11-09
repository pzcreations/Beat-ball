import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CartaoPessoa } from "@/components/atendimento/cartao";
import { DraggableCard, DropColumn } from "@/components/atendimento/kanban-dnd";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { ETAPA_COR } from "@/lib/atendimento";
import { requireGestor } from "@/lib/auth";
import { getFunil, getMensagemWhatsApp, listCartoes, listEtapas } from "@/lib/data/funil";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Atendimentos" };

const LIMITE = 50;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Funil de acompanhamento pastoral.
 *  - Celular: abas por etapa + lista de cartões com ações.
 *  - Desktop: quadro Kanban com arrastar e soltar.
 */
export default async function AtendimentosPage({ searchParams }: Props) {
  const gestor = await requireGestor();
  const raw = await searchParams;

  const [etapas, funil, mensagem] = await Promise.all([listEtapas(true), getFunil(), getMensagemWhatsApp()]);
  const visiveis = etapas.filter((e) => e.ativo || (funil.find((f) => f.id === e.id)?.total ?? 0) > 0);
  const contagem = new Map(funil.map((f) => [f.id, f]));

  const colunas = await Promise.all(
    visiveis.map(async (etapa) => {
      const finais = etapa.tipo === "concluida" || etapa.tipo === "encerrada";
      const { cartoes, total } = await listCartoes(etapa.id, LIMITE, finais);
      return { etapa, cartoes, total };
    }),
  );

  const selecionadaId = Number(raw.etapa) || visiveis[0]?.id;
  const selecionada = colunas.find((c) => c.etapa.id === selecionadaId) ?? colunas[0];
  const nomeGestor = gestor.fullName;

  return (
    <div className="grid gap-5">
      <PageHeader title="Atendimentos" description="Acompanhamento pastoral de cada pessoa cadastrada." />

      {/* ------------------------- Celular / tablet ------------------------- */}
      <div className="min-w-0 lg:hidden">
        <nav aria-label="Etapas" className="-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          <ul className="flex w-max gap-2">
            {colunas.map(({ etapa }) => {
              const f = contagem.get(etapa.id);
              const ativa = selecionada?.etapa.id === etapa.id;
              return (
                <li key={etapa.id}>
                  <Link
                    href={`/gestor/atendimentos?etapa=${etapa.id}`}
                    aria-current={ativa ? "page" : undefined}
                    scroll={false}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors",
                      ativa
                        ? "border-navy-900 bg-navy-900 text-white"
                        : "border-line bg-white text-muted hover:border-azure-300 hover:text-navy-900",
                    )}
                  >
                    <span className={cn("size-2 rounded-full", ETAPA_COR[etapa.cor].dot)} aria-hidden />
                    {etapa.nome}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-xs tabular",
                        ativa ? "bg-white/15" : "bg-surface",
                        (f?.atrasados ?? 0) > 0 && !ativa && "bg-danger-bg text-danger",
                      )}
                    >
                      {formatInt(f?.total ?? 0)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {selecionada ? (
          <section aria-label={selecionada.etapa.nome} className="mt-4 grid gap-3">
            {selecionada.cartoes.length === 0 ? (
              <div className="rounded-lg border border-line bg-white">
                <EmptyState icon={<Inbox />} title="Ninguém nesta etapa" description="Quando houver pessoas aqui, elas aparecerão nesta lista." />
              </div>
            ) : (
              selecionada.cartoes.map((c) => (
                <CartaoPessoa
                  key={c.pessoa_id}
                  cartao={c}
                  etapa={selecionada.etapa}
                  etapas={etapas}
                  mensagem={mensagem}
                  gestor={nomeGestor}
                />
              ))
            )}
            {selecionada.total > selecionada.cartoes.length ? (
              <p className="text-center text-xs text-muted">
                Mostrando {selecionada.cartoes.length} de {formatInt(selecionada.total)}. Use a busca em{" "}
                <Link href={`/gestor/cadastros?etapa=${selecionada.etapa.id}`} className="font-medium text-navy-800 underline">
                  Cadastros
                </Link>{" "}
                para ver todos.
              </p>
            ) : null}
          </section>
        ) : null}
      </div>

      {/* ------------------------------ Desktop ----------------------------- */}
      <div className="-mx-8 hidden min-w-0 overflow-x-auto px-8 pb-2 lg:block">
        <div className="flex min-w-max gap-4">
          {colunas.map(({ etapa, cartoes, total }) => {
            const f = contagem.get(etapa.id);
            return (
              <DropColumn
                key={etapa.id}
                etapaId={etapa.id}
                encerrada={etapa.tipo === "encerrada"}
                className="flex max-h-[calc(100dvh-210px)] w-[272px] shrink-0 flex-col rounded-xl border border-line bg-surface"
              >
                <header className="flex items-center gap-2 border-b border-line px-3.5 py-3">
                  <span className={cn("size-2.5 rounded-full", ETAPA_COR[etapa.cor].dot)} aria-hidden />
                  <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-navy-900">{etapa.nome}</h2>
                  {(f?.atrasados ?? 0) > 0 ? (
                    <span className="rounded-full bg-danger-bg px-1.5 text-xs font-medium text-danger tabular" title="Atrasados">
                      {f?.atrasados}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-white px-1.5 text-xs font-medium text-muted tabular">{formatInt(total)}</span>
                </header>
                <div className="grid content-start gap-2.5 overflow-y-auto p-2.5">
                  {cartoes.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-subtle">
                      Arraste um cartão para cá
                    </p>
                  ) : (
                    cartoes.map((c) => (
                      <DraggableCard key={c.pessoa_id} pessoaId={c.pessoa_id} etapaId={etapa.id}>
                        <CartaoPessoa cartao={c} etapa={etapa} etapas={etapas} mensagem={mensagem} gestor={nomeGestor} compacto />
                      </DraggableCard>
                    ))
                  )}
                  {total > cartoes.length ? (
                    <Link
                      href={`/gestor/cadastros?etapa=${etapa.id}`}
                      className="py-1 text-center text-xs font-medium text-navy-800 hover:underline"
                    >
                      Ver todos os {formatInt(total)}
                    </Link>
                  ) : null}
                </div>
              </DropColumn>
            );
          })}
        </div>
      </div>
    </div>
  );
}
