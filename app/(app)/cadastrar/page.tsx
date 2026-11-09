import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { criarPessoaAction } from "@/app/actions/pessoas";
import { PessoaList } from "@/components/pessoas/pessoa-list";
import { PessoaForm } from "@/components/pessoa-form";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { listIgrejas } from "@/lib/data/funil";
import { latestOwn } from "@/lib/data/pessoas";

export const metadata: Metadata = { title: "Cadastrar" };

/** Formulário de cadastro — disponível para recepção e gestor. */
export default async function CadastrarPage() {
  const user = await requireUser();
  const [recentes, igrejas] = await Promise.all([latestOwn(user.id, 3), listIgrejas()]);

  return (
    <div className="mx-auto grid max-w-xl gap-5">
      <PageHeader title="Novo cadastro" description="Preencha os dados e toque em Cadastrar." />

      <Card className="animate-enter p-4 md:p-6">
        <PessoaForm action={criarPessoaAction} mode="create" igrejas={igrejas} />
        <p className="mt-5 flex items-start gap-2 border-t border-line pt-4 text-xs text-muted">
          <ShieldCheck className="mt-px size-4 shrink-0 text-navy-700" aria-hidden />
          Coletamos apenas o necessário para o atendimento. O registro fica associado ao seu usuário, com data e
          horário.
        </p>
      </Card>

      {recentes.length > 0 ? (
        <Card className="animate-enter overflow-hidden">
          <CardHeader title="Cadastrados por você recentemente" />
          <PessoaList items={recentes} />
        </Card>
      ) : null}
    </div>
  );
}
