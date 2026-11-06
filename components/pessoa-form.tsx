"use client";

import { UserPlus, Save } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/card";
import { Field, Input, ariaFor } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import { formatNumero } from "@/lib/format";
import type { ActionState } from "@/lib/utils";
import { fieldErrors, pessoaSchema } from "@/lib/validation";

type Fields = { nome: string; numero: string };

function omit(obj: Record<string, string>, key: string) {
  const next = { ...obj };
  delete next[key];
  return next;
}

type Props = {
  action: (state: ActionState<Fields>, formData: FormData) => Promise<ActionState<Fields>>;
  mode: "create" | "edit";
  pessoa?: { id: string; nome: string; numero: string };
};

/**
 * Formulário de pessoa. Valida no navegador para dar retorno imediato, mas a
 * validação que vale é a do servidor (mesmo esquema) e a do banco.
 */
export function PessoaForm({ action, mode, pessoa }: Props) {
  const [state, formAction] = useActionState(action, { status: "idle" } as ActionState<Fields>);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const errors = { ...(state.errors ?? {}), ...clientErrors } as Record<string, string | undefined>;
  // No cadastro, após sucesso, o formulário é recriado (campos limpos).
  const formKey = mode === "create" && state.status === "success" ? `ok-${state.at}` : "form";
  const values = state.status === "error" ? state.values : mode === "edit" ? state.values : undefined;

  return (
    <>
      <form
        key={formKey}
        action={formAction}
        noValidate
        className="grid gap-5"
        onSubmit={(e) => {
          const fd = new FormData(e.currentTarget);
          const parsed = pessoaSchema.safeParse({ nome: fd.get("nome"), numero: fd.get("numero") });
          if (!parsed.success) {
            e.preventDefault();
            const errs = fieldErrors(parsed.error);
            setClientErrors(errs);
            const first = Object.keys(errs)[0];
            if (first) (e.currentTarget.elements.namedItem(first) as HTMLElement | null)?.focus();
          } else {
            setClientErrors({});
          }
        }}
      >
        {pessoa ? <input type="hidden" name="id" value={pessoa.id} /> : null}

        {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}

        <Field id="nome" label="Nome da pessoa" error={errors.nome}>
          <Input
            {...ariaFor("nome", errors.nome)}
            name="nome"
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
            required
            minLength={3}
            maxLength={120}
            placeholder="Nome completo"
            defaultValue={values?.nome ?? pessoa?.nome ?? ""}
            autoFocus={mode === "create"}
            onInput={() => clientErrors.nome && setClientErrors((prev) => omit(prev, "nome"))}
          />
        </Field>

        <Field
          id="numero"
          label="Número"
          error={errors.numero}
          hint="Telefone ou identificação numérica. Somente os dígitos são salvos."
        >
          <Input
            {...ariaFor("numero", errors.numero, true)}
            name="numero"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="done"
            required
            maxLength={30}
            placeholder="Ex.: (11) 98765-4321"
            defaultValue={values?.numero ?? (pessoa ? formatNumero(pessoa.numero) : "")}
            onInput={() => clientErrors.numero && setClientErrors((prev) => omit(prev, "numero"))}
          />
        </Field>

        <SubmitButton size="lg" block pendingLabel={mode === "create" ? "Cadastrando…" : "Salvando…"}>
          {mode === "create" ? (
            <>
              <UserPlus aria-hidden /> Cadastrar
            </>
          ) : (
            <>
              <Save aria-hidden /> Salvar alterações
            </>
          )}
        </SubmitButton>
      </form>

      <Toast message={state.status === "success" ? state.message : undefined} stamp={state.at} />
    </>
  );
}
