import { AlertTriangle, ArrowLeft, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { atualizarPessoaAction, excluirPessoaAction } from "@/app/actions/pessoas";
import { MudarEtapa, RegistrarContato, WhatsAppLink } from "@/components/atendimento/acoes";
import { EtapaBadge } from "@/components/atendimento/etapa-badge";
import { LinhaDoTempo } from "@/components/atendimento/linha-do-tempo";
import { PessoaForm } from "@/components/pessoa-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Alert, Card, CardHeader, PageHeader } from "@/components/ui/card";
import { destinosPermitidos, isAtrasado, prazoLabel, renderMensagem, tempoDesde, whatsappHref } from "@/lib/atendimento";
import { ConnectionError, requireGestor } from "@/lib/auth";
import { getLinhaDoTempo, getMensagemWhatsApp, listEtapas, listIgrejas } from "@/lib/data/funil";
import { getPessoa } from "@/lib/data/pessoas";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Ficha da pessoa" };

type Props = { params: Promise<{ id: string }> };

/** Ficha da pessoa: atendimento, ações, linha do tempo e dados cadastrais. */
export default async function FichaPessoaPage({ params }: Props) {
  const gestor = await requireGestor();
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const pessoa = await getPessoa(id);
  if (!pessoa) notFound();

  const supabase = await createClient();
  const [etapas, igrejas, eventos, mensagem, mesmoNumero] = await Promise.all([
    listEtapas(true),
    listIgrejas(true),
    getLinhaDoTempo(id),
    getMensagemWhatsApp(),
    supabase.from("pessoas").select("id, nome").eq("numero", pessoa.numero).neq("id", id).limit(5),
  ]);
  if (mesmoNumero.error) throw new ConnectionError();

  const atendimento = pessoa.atendimento;
  const etapa = atendimento?.etapa ? etapas.find((e) => e.id === atendimento.etapa!.id) : undefined;
  const aberto = etapa && etapa.tipo !== "concluida" && etapa.tipo !== "encerrada";
  const atrasado = atendimento && etapa ? isAtrasado(atendimento.etapa_desde, etapa.prazo_horas) : false;
  const wa = aberto
    ? whatsappHref(pessoa.numero, renderMensagem(mensagem, { nome: pessoa.nome, gestor: gestor.fullName, igreja: pessoa.igreja?.nome ?? null }))
    : null;
  // Igrejas ativas + a atual (mesmo que desativada), para não perder o vínculo.
  const igrejasForm = igrejas.filter((i) => i.ativo || i.id === pessoa.igreja_id);

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <PageHeader
        title={pessoa.nome}
        description={pessoa.igreja?.nome ?? "Igreja não informada"}
        back={
          <Link href="/gestor/atendimentos" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy-900">
            <ArrowLeft className="size-4" aria-hidden /> Atendimentos
          </Link>
        }
      />

      {mesmoNumero.data && mesmoNumero.data.length > 0 ? (
        <Alert tone="warning" className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Mesmo número de:{" "}
            {mesmoNumero.data.map((p, i) => (
              <span key={p.id}>
                {i > 0 ? ", " : ""}
                <Link href={`/gestor/cadastros/${p.id}`} className="font-medium underline">
                  {p.nome}
                </Link>
              </span>
            ))}
          </span>
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-5">
          {/* Atendimento atual */}
          <Card className="animate-enter">
            <CardHeader title="Atendimento" />
            <div className="grid gap-4 p-4 md:p-5">
              {atendimento && etapa ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <EtapaBadge nome={etapa.nome} cor={etapa.cor} atrasado={atrasado} className="px-2.5 py-1 text-sm" />
                    <p className="text-sm text-muted">
                      Nesta etapa {tempoDesde(atendimento.etapa_desde)}
                      {etapa.prazo_horas ? ` · prazo ${prazoLabel(etapa.prazo_horas)}` : ""}
                    </p>
                  </div>
                  {atendimento.tentativas_contato > 0 ? (
                    <p className="text-sm text-warning">{atendimento.tentativas_contato} tentativa(s) de contato sem resposta.</p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {wa ? <WhatsAppLink href={wa} block /> : null}
                    {aberto ? <RegistrarContato pessoaId={pessoa.id} pessoaNome={pessoa.nome} block /> : null}
                    <MudarEtapa
                      pessoaId={pessoa.id}
                      pessoaNome={pessoa.nome}
                      destinos={destinosPermitidos(etapas, etapa.id)}
                      atualTipo={etapa.tipo}
                      block
                      triggerLabel={aberto ? "Mudar etapa" : "Reabrir ou mudar etapa"}
                    />
                  </div>
                  {aberto && !wa ? (
                    <p className="text-xs text-muted">
                      O botão do WhatsApp aparece quando o número é um celular com DDD (ex.: 11 91234-5678).
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted">Atendimento não encontrado.</p>
              )}
            </div>
          </Card>

          <Card className="animate-enter">
            <CardHeader title="Linha do tempo" />
            <LinhaDoTempo eventos={eventos} />
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <Card className="animate-enter p-4 md:p-5">
            <h2 className="mb-4 text-[15px] font-semibold text-navy-900">Dados do cadastro</h2>
            <PessoaForm action={atualizarPessoaAction} mode="edit" pessoa={pessoa} igrejas={igrejasForm} />
          </Card>

          <Card className="animate-enter">
            <CardHeader title="Informações do registro" />
            <dl className="grid gap-3 p-4 text-sm md:p-5">
              <div>
                <dt className="text-xs text-muted">Cadastrado em</dt>
                <dd className="text-navy-900">{formatDateTime(pessoa.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Responsável pelo cadastro</dt>
                <dd className="text-navy-900">{pessoa.autor?.full_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Última atualização</dt>
                <dd className="text-navy-900">
                  {pessoa.updated_by ? `${formatDateTime(pessoa.updated_at)} · ${pessoa.editor?.full_name ?? "—"}` : "Sem alterações"}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="animate-enter border-[#f6d3cf]">
            <CardHeader title="Excluir cadastro" description="Remove a pessoa e o histórico do atendimento." />
            <div className="p-4 md:p-5">
              <ConfirmDialog
                trigger={
                  <>
                    <Trash2 aria-hidden /> Excluir cadastro
                  </>
                }
                title="Excluir este cadastro?"
                description={
                  <>
                    O cadastro de <strong className="font-medium text-navy-900">{pessoa.nome}</strong> e todo o histórico de
                    atendimento serão removidos permanentemente. A exclusão fica registrada no histórico de atividades.
                  </>
                }
                confirmLabel="Excluir"
                action={excluirPessoaAction}
                fields={{ id: pessoa.id }}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
