import { LogOut, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { signOutAction } from "@/app/actions/session";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/format";

import { NomeForm, SenhaForm } from "./account-forms";

export const metadata: Metadata = { title: "Minha conta" };

/** Configurações da conta (ambos os perfis). */
export default async function ContaPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <PageHeader title="Minha conta" description="Dados de acesso e segurança." />

      <Card className="animate-enter">
        <CardHeader title="Perfil" />
        <div className="grid gap-5 p-4 md:p-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">E-mail de acesso</dt>
              <dd className="break-all text-navy-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Perfil</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1.5">
                <Badge tone={user.role === "gestor" ? "navy" : "azure"}>{ROLE_LABEL[user.role]}</Badge>
                {user.role === "recepcao" ? (
                  <Badge>{user.canViewRecords ? "Consulta de todos os cadastros" : "Consulta dos próprios cadastros"}</Badge>
                ) : null}
              </dd>
            </div>
          </dl>
          <div className="border-t border-line pt-5">
            <NomeForm fullName={user.fullName} />
          </div>
        </div>
      </Card>

      <Card className="animate-enter">
        <CardHeader title="Alterar senha" description="Por segurança, confirme a senha atual." />
        <div className="p-4 md:p-6">
          <SenhaForm />
        </div>
      </Card>

      <Card className="animate-enter">
        <CardHeader title="Sessão" />
        <div className="grid gap-4 p-4 md:p-6">
          <p className="flex items-start gap-2 text-sm text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-navy-700" aria-hidden />
            Ao sair, sua sessão é encerrada no servidor. Em aparelhos compartilhados, sempre saia ao terminar.
          </p>
          <form action={signOutAction}>
            <Button type="submit" variant="danger-outline" block className="sm:w-auto">
              <LogOut aria-hidden /> Sair do sistema
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
