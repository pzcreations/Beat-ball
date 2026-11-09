import { ChevronRight, Church, Phone } from "lucide-react";
import Link from "next/link";

import { EtapaBadge } from "@/components/atendimento/etapa-badge";
import { isAtrasado } from "@/lib/atendimento";
import type { PessoaListItem } from "@/lib/data/pessoas";
import { formatNumero, formatRelative } from "@/lib/format";

type Item = Pick<PessoaListItem, "id" | "nome" | "numero" | "created_at" | "autor" | "igreja" | "atendimento">;

type Props = {
  items: Item[];
  /** Mostra quem cadastrou (somente gestor). */
  showAuthor?: boolean;
  /** Se definido, cada item vira link para a ficha. */
  hrefFor?: (id: string) => string;
};

const igrejaCurta = (nome: string) => nome.replace(/^Igreja Adventista /i, "IASD ");

function Etapa({ item }: { item: Item }) {
  const a = item.atendimento;
  if (!a?.etapa) return null;
  return <EtapaBadge nome={a.etapa.nome} cor={a.etapa.cor} atrasado={isAtrasado(a.etapa_desde, a.etapa.prazo_horas)} />;
}

/**
 * Lista responsiva: cartões no celular, tabela compacta a partir do tablet.
 * Todo texto é renderizado pelo React (escapado), o que impede XSS.
 * A etapa só aparece quando o banco permite (RLS): gestor vê todas, a
 * recepção apenas as das pessoas que ela cadastrou.
 */
export function PessoaList({ items, showAuthor, hrefFor }: Props) {
  const hasEtapa = items.some((i) => i.atendimento?.etapa);
  return (
    <>
      {/* Celular: cartões */}
      <ul className="divide-y divide-line md:hidden">
        {items.map((p) => {
          const content = (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-navy-900">{p.nome}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted tabular">
                  <Phone className="size-3.5 text-subtle" aria-hidden />
                  {formatNumero(p.numero)}
                </p>
                {p.igreja ? (
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-muted">
                    <Church className="size-3.5 shrink-0 text-subtle" aria-hidden />
                    <span className="truncate">{igrejaCurta(p.igreja.nome)}</span>
                  </p>
                ) : null}
                {p.atendimento?.etapa ? (
                  <div className="mt-1.5">
                    <Etapa item={p} />
                  </div>
                ) : null}
                <p className="mt-1 text-xs text-subtle">
                  {formatRelative(p.created_at)}
                  {showAuthor && p.autor ? ` · por ${p.autor.full_name}` : ""}
                </p>
              </div>
              {hrefFor ? <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden /> : null}
            </>
          );
          return (
            <li key={p.id}>
              {hrefFor ? (
                <Link href={hrefFor(p.id)} className="flex items-center gap-3 px-4 py-3.5 active:bg-azure-50">
                  {content}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Tablet/desktop: tabela */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-medium uppercase tracking-[0.04em] text-subtle">
              <th scope="col" className="px-5 py-3 font-medium">Nome</th>
              <th scope="col" className="px-5 py-3 font-medium">Número</th>
              <th scope="col" className="px-5 py-3 font-medium">Igreja</th>
              {hasEtapa ? <th scope="col" className="px-5 py-3 font-medium">Etapa</th> : null}
              <th scope="col" className="px-5 py-3 font-medium">Cadastro</th>
              {showAuthor ? <th scope="col" className="px-5 py-3 font-medium">Responsável</th> : null}
              {hrefFor ? <th scope="col" className="w-12 px-5 py-3"><span className="sr-only">Ações</span></th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((p) => (
              <tr key={p.id} className="group transition-colors hover:bg-azure-50/60">
                <td className="max-w-[240px] truncate px-5 py-3 font-medium text-navy-900">
                  {hrefFor ? (
                    <Link href={hrefFor(p.id)} className="hover:underline">
                      {p.nome}
                    </Link>
                  ) : (
                    p.nome
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-muted tabular">{formatNumero(p.numero)}</td>
                <td className="max-w-[180px] truncate px-5 py-3 text-muted">{p.igreja ? igrejaCurta(p.igreja.nome) : "—"}</td>
                {hasEtapa ? (
                  <td className="whitespace-nowrap px-5 py-3">
                    <Etapa item={p} />
                  </td>
                ) : null}
                <td className="whitespace-nowrap px-5 py-3 text-muted">{formatRelative(p.created_at)}</td>
                {showAuthor ? <td className="max-w-[160px] truncate px-5 py-3 text-muted">{p.autor?.full_name ?? "—"}</td> : null}
                {hrefFor ? (
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={hrefFor(p.id)}
                      className="inline-grid size-8 place-items-center rounded-md text-subtle hover:bg-azure-100 hover:text-navy-800"
                      aria-label={`Abrir ficha de ${p.nome}`}
                    >
                      <ChevronRight className="size-4" />
                    </Link>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
