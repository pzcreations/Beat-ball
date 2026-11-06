import { ArrowLeft, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { atualizarPessoaAction, excluirPessoaAction } from "@/app/actions/pessoas";
import { AuditTimeline } from "@/components/audit/audit-timeline";
import { PessoaForm } from "@/components/pessoa-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { ConnectionError, requireGestor } from "@/lib/auth";
import { getPessoa } from "@/lib/data/pessoas";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Editar cadastro" };

type Props = { params: Promise<{ id: string }> };

/** Edição de registro + metadados + histórico do próprio registro. */
export default async function EditarCadastroPage({ params }: Props) {
  await requireGestor();
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const pessoa = await getPessoa(id);
  if (!pessoa) notFound();

  const supabase = await createClient();
  const { data: historico, error } = await supabase
    .from("audit_log")
    .select("id, occurred_at, action, entity, entity_id, details, ator:profiles!audit_log_actor_id_fkey(full_name)")
    .eq("entity", "pessoa")
    .eq("entity_id", id)
    .order("occurred_at", { ascending: false })
    .limit(20);
  if (error) throw new ConnectionError();

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <PageHeader
        title="Editar cadastro"
        back={
          <Link href="/gestor/cadastros" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy-900">
            <ArrowLeft className="size-4" aria-hidden /> Cadastros
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="animate-enter p-4 md:p-6">
          <PessoaForm action={atualizarPessoaAction} mode="edit" pessoa={pessoa} />
        </Card>

        <div className="grid content-start gap-5">
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
              <div>
                <dt className="text-xs text-muted">Identificador</dt>
                <dd className="break-all font-mono text-xs text-muted">{pessoa.id}</dd>
              </div>
            </dl>
          </Card>

          <Card className="animate-enter border-[#f6d3cf]">
            <CardHeader title="Excluir cadastro" description="A exclusão é registrada no histórico." />
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
                    O cadastro de <strong className="font-medium text-navy-900">{pessoa.nome}</strong> será removido
                    permanentemente. Esta ação não pode ser desfeita.
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

      <Card className="animate-enter">
        <CardHeader title="Histórico deste registro" />
        <AuditTimeline entries={historico ?? []} compact />
      </Card>
    </div>
  );
}
