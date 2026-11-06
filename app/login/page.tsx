import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BrandLockup, BrandMark } from "@/components/brand";
import { Alert } from "@/components/ui/card";
import { getCurrentUser, homePathFor } from "@/lib/auth";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const erro = typeof params.erro === "string" ? params.erro : undefined;
  const saiu = params.saiu === "1";
  const next = typeof params.next === "string" ? params.next : "";

  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }
  if (user?.active) redirect(homePathFor(user));

  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Painel institucional (desktop) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navy-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark className="size-9 [&_rect:first-child]:fill-white/10" />
          <span className="text-lg font-semibold tracking-tight">Recepção</span>
        </div>
        <div className="max-w-md">
          <p className="text-[28px] font-semibold leading-tight tracking-tight">
            Atendimento organizado, registros seguros.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-azure-200/90">
            Cadastro de visitantes com controle de acesso por perfil, histórico de alterações e proteção de dados
            pessoais.
          </p>
        </div>
        <p className="flex items-center gap-2 text-sm text-azure-200/80">
          <ShieldCheck className="size-4" aria-hidden />
          Acesso restrito a usuários autorizados
        </p>
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full border border-white/10" />
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 size-48 rounded-full border border-white/10" />
      </aside>

      {/* Formulário */}
      <main id="conteudo" className="pt-safe flex min-h-dvh flex-col px-5 lg:min-h-0 lg:justify-center lg:px-16">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 lg:flex-none">
          <div className="mb-10 lg:hidden">
            <BrandLockup subtitle="Acesso ao sistema" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-navy-900">Entrar</h1>
          <p className="mt-1.5 text-sm text-muted">Use o e-mail e a senha fornecidos pelo gestor.</p>

          <div className="mt-6 grid gap-3">
            {erro === "inativo" ? (
              <Alert tone="warning">Seu acesso está desativado ou pendente de liberação. Procure o gestor.</Alert>
            ) : null}
            {saiu ? <Alert tone="info">Você saiu do sistema com segurança.</Alert> : null}
          </div>

          <div className="mt-6">
            <LoginForm next={next} />
          </div>
        </div>
        <p className="pb-safe mx-auto mb-6 max-w-sm text-center text-xs text-subtle">
          Os dados pessoais são tratados conforme a LGPD e acessados apenas por pessoas autorizadas.
        </p>
      </main>
    </div>
  );
}
