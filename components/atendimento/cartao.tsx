import { Church, Phone, RotateCcw } from "lucide-react";
import Link from "next/link";

import { MudarEtapa, RegistrarContato, WhatsAppLink } from "@/components/atendimento/acoes";
import { destinosPermitidos, isAtrasado, renderMensagem, tempoDesde, whatsappHref, type EtapaInfo } from "@/lib/atendimento";
import type { CartaoAtendimento } from "@/lib/data/funil";
import { formatNumero } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  cartao: CartaoAtendimento;
  etapa: EtapaInfo;
  etapas: EtapaInfo[];
  mensagem: string;
  gestor: string;
  /** Versão compacta para o quadro Kanban. */
  compacto?: boolean;
};

/** Cartão de uma pessoa no funil, com as ações do gestor. */
export function CartaoPessoa({ cartao, etapa, etapas, mensagem, gestor, compacto }: Props) {
  const pessoa = cartao.pessoa!;
  const atrasado = isAtrasado(cartao.etapa_desde, etapa.prazo_horas);
  const aberto = etapa.tipo !== "concluida" && etapa.tipo !== "encerrada";
  const wa = aberto
    ? whatsappHref(pessoa.numero, renderMensagem(mensagem, { nome: pessoa.nome, gestor, igreja: pessoa.igreja?.nome ?? null }))
    : null;
  const destinos = destinosPermitidos(etapas, etapa.id);

  return (
    <article
      className={cn(
        "rounded-lg border bg-white",
        atrasado ? "border-[#f3c4bf]" : "border-line",
        compacto ? "p-3" : "p-4",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/gestor/cadastros/${pessoa.id}`}
          className={cn("min-w-0 font-medium text-navy-900 hover:underline", compacto ? "text-sm" : "text-[15px]")}
        >
          <span className="line-clamp-2">{pessoa.nome}</span>
        </Link>
        <span
          className={cn(
            "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
            atrasado ? "bg-danger-bg text-danger" : "bg-surface text-muted",
          )}
          title={atrasado ? "Prazo desta etapa ultrapassado" : "Tempo nesta etapa"}
        >
          {atrasado ? "Atrasado · " : ""}
          {tempoDesde(cartao.etapa_desde)}
        </span>
      </div>

      <div className={cn("mt-1.5 grid gap-0.5 text-muted", compacto ? "text-xs" : "text-[13px]")}>
        {pessoa.igreja ? (
          <p className="flex items-center gap-1.5 truncate">
            <Church className="size-3.5 shrink-0 text-subtle" aria-hidden />
            <span className="truncate">{pessoa.igreja.nome.replace(/^Igreja Adventista /i, "IASD ")}</span>
          </p>
        ) : null}
        <p className="flex items-center gap-1.5 tabular">
          <Phone className="size-3.5 shrink-0 text-subtle" aria-hidden />
          {formatNumero(pessoa.numero)}
        </p>
        {cartao.tentativas_contato > 0 ? (
          <p className="flex items-center gap-1.5 text-warning">
            <RotateCcw className="size-3.5 shrink-0" aria-hidden />
            {cartao.tentativas_contato} tentativa(s) sem resposta
          </p>
        ) : null}
      </div>

      <div className={cn("flex gap-2", compacto ? "mt-2.5" : "mt-3.5")}>
        {wa ? <WhatsAppLink href={wa} compact size={compacto ? "sm" : "md"} /> : null}
        {aberto ? (
          <RegistrarContato
            pessoaId={pessoa.id}
            pessoaNome={pessoa.nome}
            compact={compacto}
            size={compacto ? "sm" : "md"}
            block={!compacto}
          />
        ) : null}
        <MudarEtapa
          pessoaId={pessoa.id}
          pessoaNome={pessoa.nome}
          destinos={destinos}
          atualTipo={etapa.tipo}
          compact
          size={compacto ? "sm" : "md"}
          triggerLabel={aberto ? "Mudar etapa" : "Reabrir ou mudar etapa"}
        />
      </div>
    </article>
  );
}
