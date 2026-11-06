import { ChevronRight, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FlashToast } from "@/components/flash-toast";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/card";
import { ConnectionError, requireGestor } from "@/lib/auth";
import { ROLE_LABEL, initials } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Equipe" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Gerenciamento de usuários e permissões. */
export default async function UsuariosPage({ searchParams }: Props) {
  const me = await requireGestor();
  const raw = await searchParams;
  const supabase = await createClient();
  const { data: usuarios, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, can_view_records, active")
    .order("active", { ascending: false })
    .order("role", { ascending: false })
    .order("full_name");
  if (error) throw new ConnectionError();

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Equipe"
        description="Usuários, perfis de acesso e permissões."
        action={
          <ButtonLink href="/gestor/usuarios/novo">
            <Plus aria-hidden /> <span className="hidden sm:inline">Novo usuário</span>
            <span className="sm:hidden">Novo</span>
          </ButtonLink>
        }
      />

      <Card className="animate-enter overflow-hidden">
        {!usuarios || usuarios.length === 0 ? (
          <EmptyState icon={<Users />} title="Nenhum usuário" />
        ) : (
          <ul className="divide-y divide-line">
            {usuarios.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/gestor/usuarios/${u.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-azure-50/60 active:bg-azure-50 md:px-5"
                >
                  <span
                    aria-hidden
                    className={`grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold ${
                      u.active ? "bg-azure-100 text-navy-800" : "bg-surface text-subtle"
                    }`}
                  >
                    {initials(u.full_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-medium ${u.active ? "text-navy-900" : "text-muted"}`}>
                      {u.full_name}
                      {u.id === me.id ? <span className="font-normal text-subtle"> (você)</span> : null}
                    </p>
                    <p className="truncate text-sm text-muted">{u.email}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone={u.role === "gestor" ? "navy" : "azure"}>{ROLE_LABEL[u.role]}</Badge>
                      {u.role === "recepcao" && u.can_view_records ? <Badge>Consulta liberada</Badge> : null}
                      {!u.active ? <Badge tone="warning">Inativo</Badge> : null}
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <FlashToast msg={typeof raw.msg === "string" ? raw.msg : undefined} />
    </div>
  );
}
