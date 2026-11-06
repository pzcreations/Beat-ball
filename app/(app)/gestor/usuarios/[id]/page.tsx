import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuditTimeline, type AuditEntry } from "@/components/audit/audit-timeline";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/card";
import { ConnectionError, requireGestor } from "@/lib/auth";
import { ROLE_LABEL, formatDateTime, formatInt } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

import { EditarUsuarioForm, RedefinirSenhaForm } from "../user-forms";

export const metadata: Metadata = { title: "Usuário" };

type Props = { params: Promise<{ id: string }> };

export default async function UsuarioPage({ params }: Props) {
  const me = await requireGestor();
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const [userRes, countRes, eventsRes] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role, can_view_records, active, created_at").eq("id", id).maybeSingle(),
    supabase.from("pessoas").select("id", { count: "exact", head: true }).eq("created_by", id),
    supabase
      .from("audit_log")
      .select("id, occurred_at, action, entity, entity_id, details, ator:profiles!audit_log_actor_id_fkey(full_name)")
      .eq("actor_id", id)
      .order("occurred_at", { ascending: false })
      .limit(10),
  ]);
  if (userRes.error || countRes.error || eventsRes.error) throw new ConnectionError();
  const user = userRes.data;
  if (!user) notFound();
  const isSelf = user.id === me.id;

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <PageHeader
        title={user.full_name}
        description={user.email}
        back={
          <Link href="/gestor/usuarios" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy-900">
            <ArrowLeft className="size-4" aria-hidden /> Equipe
          </Link>
        }
        action={
          <div className="flex gap-1.5">
            <Badge tone={user.role === "gestor" ? "navy" : "azure"}>{ROLE_LABEL[user.role]}</Badge>
            {!user.active ? <Badge tone="warning">Inativo</Badge> : null}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="animate-enter">
          <CardHeader
            title="Perfil e permissões"
            description={isSelf ? "Por segurança, você não pode alterar o seu próprio perfil ou status." : undefined}
          />
          <div className="p-4 md:p-6">
            <EditarUsuarioForm user={user} isSelf={isSelf} />
          </div>
        </Card>

        <div className="grid content-start gap-5">
          <Card className="animate-enter">
            <CardHeader title="Resumo" />
            <dl className="grid grid-cols-2 gap-3 p-4 text-sm md:p-5">
              <div>
                <dt className="text-xs text-muted">Cadastros feitos</dt>
                <dd className="text-xl font-semibold text-navy-900 tabular">{formatInt(countRes.count ?? 0)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Usuário desde</dt>
                <dd className="text-navy-900">{formatDateTime(user.created_at).split(" às")[0]}</dd>
              </div>
            </dl>
          </Card>

          <Card className="animate-enter">
            <CardHeader title="Redefinir senha" />
            <div className="p-4 md:p-5">
              <RedefinirSenhaForm userId={user.id} />
            </div>
          </Card>
        </div>
      </div>

      <Card className="animate-enter">
        <CardHeader title="Atividade recente" />
        <AuditTimeline entries={(eventsRes.data ?? []) as unknown as AuditEntry[]} compact />
      </Card>
    </div>
  );
}
