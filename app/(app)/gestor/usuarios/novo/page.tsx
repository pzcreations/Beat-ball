import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card, PageHeader } from "@/components/ui/card";
import { requireGestor } from "@/lib/auth";

import { NovoUsuarioForm } from "../user-forms";

export const metadata: Metadata = { title: "Novo usuário" };

export default async function NovoUsuarioPage() {
  await requireGestor();
  return (
    <div className="mx-auto grid max-w-xl gap-5">
      <PageHeader
        title="Novo usuário"
        description="O acesso fica ativo imediatamente. Informe a senha inicial ao usuário por um canal seguro."
        back={
          <Link href="/gestor/usuarios" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy-900">
            <ArrowLeft className="size-4" aria-hidden /> Equipe
          </Link>
        }
      />
      <Card className="animate-enter p-4 md:p-6">
        <NovoUsuarioForm />
      </Card>
    </div>
  );
}
