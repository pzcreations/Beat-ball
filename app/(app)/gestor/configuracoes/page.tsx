import { ArrowDown, ArrowUp, Lock, Plus, Save, Trash2 } from "lucide-react";
import type { Metadata } from "next";

import { EtapaBadge } from "@/components/atendimento/etapa-badge";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ETAPA_COR, renderMensagem, type EtapaInfo } from "@/lib/atendimento";
import { requireGestor } from "@/lib/auth";
import { getMensagemWhatsApp, listEtapas, listIgrejas } from "@/lib/data/funil";

import {
  alternarEtapaAction,
  alternarIgrejaAction,
  criarEtapaAction,
  criarIgrejaAction,
  excluirEtapaAction,
  reordenarEtapaAction,
  salvarEtapaAction,
  salvarIgrejaAction,
  salvarMensagemAction,
} from "./actions";

export const metadata: Metadata = { title: "Configurações" };

const TIPO_DESC: Record<EtapaInfo["tipo"], string> = {
  inicial: "Primeira etapa: todo cadastro novo ou reaberto entra aqui.",
  intermediaria: "",
  concluida: "Etapa final de sucesso.",
  encerrada: "Fim sem sucesso (sempre com motivo).",
};

function PrazoFields({ horas, idPrefix }: { horas: number | null; idPrefix: string }) {
  const emDias = horas !== null && horas % 24 === 0;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`${idPrefix}-prazo`} className="text-xs text-muted">
        Prazo até ficar atrasado
      </Label>
      <div className="flex gap-2">
        <Input
          id={`${idPrefix}-prazo`}
          name="prazoValor"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Sem prazo"
          defaultValue={horas === null ? "" : emDias ? horas / 24 : horas}
          className="w-28"
        />
        <Select name="prazoUnidade" defaultValue={emDias || horas === null ? "dias" : "horas"} aria-label="Unidade do prazo" className="flex-1">
          <option value="horas">horas</option>
          <option value="dias">dias</option>
        </Select>
      </div>
    </div>
  );
}

function CorSelect({ value, id }: { value?: string; id: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted">
        Cor
      </Label>
      <Select id={id} name="cor" defaultValue={value ?? ""} required>
        {value ? null : (
          <option value="" disabled>
            Escolha
          </option>
        )}
        {Object.entries(ETAPA_COR).map(([k, c]) => (
          <option key={k} value={k}>
            {c.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Configurações do gestor: etapas do funil, igrejas e mensagem do WhatsApp. */
export default async function ConfiguracoesPage() {
  const gestor = await requireGestor();
  const [etapas, igrejas, mensagem] = await Promise.all([listEtapas(true), listIgrejas(true), getMensagemWhatsApp()]);
  const intermediarias = etapas.filter((e) => e.tipo === "intermediaria");

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <PageHeader title="Configurações" description="Etapas do acompanhamento, igrejas e mensagem do WhatsApp." />

      {/* ------------------------------ Etapas ------------------------------ */}
      <Card className="animate-enter">
        <CardHeader
          title="Etapas do acompanhamento"
          description="Renomeie, mude cores e prazos. Etapas essenciais (com cadeado) não podem ser removidas."
        />
        <ul className="divide-y divide-line">
          {etapas.map((e) => {
            const posInter = intermediarias.findIndex((x) => x.id === e.id);
            return (
              <li key={e.id} className={`grid gap-3 px-4 py-4 md:px-5 ${e.ativo ? "" : "bg-surface"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <EtapaBadge nome={e.nome} cor={e.cor} />
                  {e.tipo !== "intermediaria" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-subtle">
                      <Lock className="size-3" aria-hidden /> Essencial
                    </span>
                  ) : null}
                  {!e.ativo ? <Badge tone="warning">Desativada</Badge> : null}
                  {e.tipo === "intermediaria" ? (
                    <div className="ml-auto flex gap-1">
                      <ActionForm action={reordenarEtapaAction} className="contents">
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="direcao" value="subir" />
                        <SubmitButton variant="ghost" size="icon-sm" aria-label={`Subir ${e.nome}`} disabled={posInter === 0}>
                          <ArrowUp />
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm action={reordenarEtapaAction} className="contents">
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="direcao" value="descer" />
                        <SubmitButton
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Descer ${e.nome}`}
                          disabled={posInter === intermediarias.length - 1}
                        >
                          <ArrowDown />
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  ) : null}
                </div>
                {TIPO_DESC[e.tipo] ? <p className="-mt-1 text-xs text-muted">{TIPO_DESC[e.tipo]}</p> : null}

                <ActionForm action={salvarEtapaAction} className="sm:grid-cols-[1fr_150px_auto] sm:items-end">
                  <input type="hidden" name="id" value={e.id} />
                  <div className="grid gap-1.5">
                    <Label htmlFor={`etapa-${e.id}-nome`} className="text-xs text-muted">
                      Nome
                    </Label>
                    <Input id={`etapa-${e.id}-nome`} name="nome" defaultValue={e.nome} maxLength={60} required />
                  </div>
                  <CorSelect id={`etapa-${e.id}-cor`} value={e.cor} />
                  <div className="sm:col-span-full sm:grid sm:grid-cols-[1fr_auto] sm:items-end sm:gap-3">
                    {e.tipo === "concluida" || e.tipo === "encerrada" ? (
                      <input type="hidden" name="prazoValor" value="" />
                    ) : (
                      <PrazoFields horas={e.prazo_horas} idPrefix={`etapa-${e.id}`} />
                    )}
                    <SubmitButton variant="outline" className="mt-3 w-full sm:mt-0 sm:w-auto" pendingLabel="Salvando…">
                      <Save aria-hidden /> Salvar
                    </SubmitButton>
                  </div>
                </ActionForm>

                {e.tipo === "intermediaria" ? (
                  <div className="flex flex-wrap gap-2">
                    <ActionForm action={alternarEtapaAction} className="contents">
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="ativo" value={e.ativo ? "false" : "true"} />
                      <SubmitButton variant="ghost" size="sm">
                        {e.ativo ? "Desativar" : "Reativar"}
                      </SubmitButton>
                    </ActionForm>
                    <ConfirmDialog
                      trigger={
                        <>
                          <Trash2 aria-hidden /> Excluir
                        </>
                      }
                      triggerVariant="danger-outline"
                      triggerSize="sm"
                      title="Excluir esta etapa?"
                      description={
                        <>
                          A etapa <strong className="font-medium text-navy-900">{e.nome}</strong> será removida. Etapas que já
                          tiveram pessoas não podem ser excluídas — nesse caso, desative-a.
                        </>
                      }
                      confirmLabel="Excluir"
                      action={excluirEtapaAction}
                      fields={{ id: String(e.id) }}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="border-t border-line bg-azure-50/50 px-4 py-4 md:px-5">
          <p className="mb-3 text-sm font-medium text-navy-900">Nova etapa</p>
          <ActionForm action={criarEtapaAction} resetOnSuccess className="sm:grid-cols-[1fr_150px]">
            <div className="grid gap-1.5">
              <Label htmlFor="nova-etapa-nome" className="text-xs text-muted">
                Nome
              </Label>
              <Input id="nova-etapa-nome" name="nome" maxLength={60} required placeholder="Ex.: Retorno pastoral" />
            </div>
            <CorSelect id="nova-etapa-cor" />
            <div className="sm:col-span-full sm:grid sm:grid-cols-[1fr_auto] sm:items-end sm:gap-3">
              <PrazoFields horas={null} idPrefix="nova-etapa" />
              <SubmitButton className="mt-3 w-full sm:mt-0 sm:w-auto" pendingLabel="Criando…">
                <Plus aria-hidden /> Adicionar etapa
              </SubmitButton>
            </div>
          </ActionForm>
          <p className="mt-2 text-xs text-muted">A nova etapa entra antes de “concluído”. Use as setas para reposicionar.</p>
        </div>
      </Card>

      {/* ------------------------------ Igrejas ----------------------------- */}
      <Card className="animate-enter">
        <CardHeader title="Igrejas" description="Aparecem como opção no formulário de cadastro." />
        <ul className="divide-y divide-line">
          {igrejas.map((i) => (
            <li key={i.id} className={`grid gap-2 px-4 py-3.5 md:px-5 ${i.ativo ? "" : "bg-surface"}`}>
              <ActionForm action={salvarIgrejaAction} className="grid-cols-[1fr_auto] items-end">
                <input type="hidden" name="id" value={i.id} />
                <div className="grid gap-1.5">
                  <Label htmlFor={`igreja-${i.id}`} className="flex items-center gap-2 text-xs text-muted">
                    Nome {!i.ativo ? <Badge tone="warning">Desativada</Badge> : null}
                  </Label>
                  <Input id={`igreja-${i.id}`} name="nome" defaultValue={i.nome} maxLength={120} required />
                </div>
                <SubmitButton variant="outline" size="icon" aria-label={`Salvar ${i.nome}`}>
                  <Save />
                </SubmitButton>
              </ActionForm>
              <ActionForm action={alternarIgrejaAction} className="contents">
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="ativo" value={i.ativo ? "false" : "true"} />
                <div>
                  <SubmitButton variant="ghost" size="sm">
                    {i.ativo ? "Desativar para novos cadastros" : "Reativar"}
                  </SubmitButton>
                </div>
              </ActionForm>
            </li>
          ))}
        </ul>
        <div className="border-t border-line bg-azure-50/50 px-4 py-4 md:px-5">
          <ActionForm action={criarIgrejaAction} resetOnSuccess className="grid-cols-[1fr_auto] items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="nova-igreja" className="text-xs text-muted">
                Nova igreja
              </Label>
              <Input id="nova-igreja" name="nome" maxLength={120} required placeholder="Ex.: Igreja Adventista …" />
            </div>
            <SubmitButton aria-label="Adicionar igreja" pendingLabel="">
              <Plus aria-hidden /> <span className="hidden sm:inline">Adicionar</span>
            </SubmitButton>
          </ActionForm>
        </div>
      </Card>

      {/* ------------------------------ Mensagem ---------------------------- */}
      <Card className="animate-enter">
        <CardHeader title="Mensagem do WhatsApp" description="Texto que já vem escrito ao tocar em “Chamar no WhatsApp”." />
        <div className="grid gap-4 p-4 md:p-5">
          <ActionForm action={salvarMensagemAction}>
            <Label htmlFor="mensagem">Mensagem</Label>
            <Textarea id="mensagem" name="mensagem" defaultValue={mensagem} maxLength={1000} rows={6} required />
            <p className="text-xs text-muted">
              Use <code className="rounded bg-surface px-1">{"{primeiro_nome}"}</code>,{" "}
              <code className="rounded bg-surface px-1">{"{nome}"}</code>,{" "}
              <code className="rounded bg-surface px-1">{"{gestor}"}</code> e{" "}
              <code className="rounded bg-surface px-1">{"{igreja}"}</code> — eles são trocados pelos dados de cada pessoa.
            </p>
            <div>
              <SubmitButton pendingLabel="Salvando…">
                <Save aria-hidden /> Salvar mensagem
              </SubmitButton>
            </div>
          </ActionForm>
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.04em] text-subtle">Exemplo</p>
            <p className="whitespace-pre-wrap text-sm text-ink">
              {renderMensagem(mensagem, {
                nome: "Maria da Silva",
                gestor: gestor.fullName,
                igreja: igrejas.find((i) => i.ativo)?.nome ?? null,
              })}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
