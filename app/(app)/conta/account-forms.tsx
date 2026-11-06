"use client";

import { KeyRound, Save } from "lucide-react";
import { useActionState } from "react";

import { Alert } from "@/components/ui/card";
import { Field, Input, ariaFor } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/utils";

import { alterarSenhaAction, atualizarNomeAction } from "./actions";

export function NomeForm({ fullName }: { fullName: string }) {
  const [state, formAction] = useActionState(atualizarNomeAction, { status: "idle" } as ActionState<{ fullName: string }>);
  const e = state.errors ?? {};
  return (
    <>
      <form action={formAction} className="grid gap-4" noValidate>
        {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}
        <Field id="fullName" label="Nome de exibição" error={e.fullName}>
          <Input {...ariaFor("fullName", e.fullName)} name="fullName" required maxLength={120} defaultValue={state.values?.fullName ?? fullName} />
        </Field>
        <div>
          <SubmitButton variant="outline" pendingLabel="Salvando…">
            <Save aria-hidden /> Salvar nome
          </SubmitButton>
        </div>
      </form>
      <Toast message={state.status === "success" ? state.message : undefined} stamp={state.at} />
    </>
  );
}

export function SenhaForm() {
  const [state, formAction] = useActionState(alterarSenhaAction, { status: "idle" } as ActionState<{ atual: string; nova: string; confirmacao: string }>);
  const e = state.errors ?? {};
  return (
    <>
      <form action={formAction} key={state.status === "success" ? state.at : "senha"} className="grid gap-4" noValidate>
        {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}
        <Field id="atual" label="Senha atual" error={e.atual}>
          <Input {...ariaFor("atual", e.atual)} name="atual" type="password" autoComplete="current-password" required />
        </Field>
        <Field id="nova" label="Nova senha" error={e.nova} hint="Mínimo de 10 caracteres, com letras e números.">
          <Input {...ariaFor("nova", e.nova, true)} name="nova" type="password" autoComplete="new-password" required minLength={10} maxLength={72} />
        </Field>
        <Field id="confirmacao" label="Confirmar nova senha" error={e.confirmacao}>
          <Input {...ariaFor("confirmacao", e.confirmacao)} name="confirmacao" type="password" autoComplete="new-password" required />
        </Field>
        <div>
          <SubmitButton variant="outline" pendingLabel="Alterando…">
            <KeyRound aria-hidden /> Alterar senha
          </SubmitButton>
        </div>
      </form>
      <Toast message={state.status === "success" ? state.message : undefined} stamp={state.at} />
    </>
  );
}
