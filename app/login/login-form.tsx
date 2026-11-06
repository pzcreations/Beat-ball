"use client";

import { Eye, EyeOff, LogIn } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/card";
import { Field, Input, ariaFor } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState } from "@/lib/utils";

import { loginAction } from "./actions";

type Fields = { email: string; senha: string };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(loginAction, { status: "idle" } as ActionState<Fields>);
  const [show, setShow] = useState(false);
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}

      <Field id="email" label="E-mail" error={errors.email}>
        <Input
          {...ariaFor("email", errors.email)}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.values?.email ?? ""}
          placeholder="nome@empresa.com.br"
        />
      </Field>

      <Field id="senha" label="Senha" error={errors.senha}>
        <div className="relative">
          <Input
            {...ariaFor("senha", errors.senha)}
            name="senha"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-md text-subtle hover:text-navy-800"
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={show}
          >
            {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
      </Field>

      <SubmitButton size="lg" block pendingLabel="Entrando…" className="mt-1">
        <LogIn aria-hidden /> Entrar
      </SubmitButton>
    </form>
  );
}
