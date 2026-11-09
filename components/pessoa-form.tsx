"use client";

import { Save, UserPlus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { Alert } from "@/components/ui/card";
import { Field, Input, Select, ariaFor } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toast } from "@/components/ui/toast";
import { formatNumero } from "@/lib/format";
import type { ActionState } from "@/lib/utils";
import { fieldErrors, pessoaSchema } from "@/lib/validation";

type Fields = { nome: string; numero: string; igrejaId: string };

/** Preferência local do aparelho (não é dado sensível). */
const IGREJA_KEY = "recepcao:ultima-igreja";

function omit(obj: Record<string, string>, key: string) {
  const next = { ...obj };
  delete next[key];
  return next;
}

type Props = {
  action: (state: ActionState<Fields>, formData: FormData) => Promise<ActionState<Fields>>;
  mode: "create" | "edit";
  igrejas: { id: number; nome: string }[];
  pessoa?: { id: string; nome: string; numero: string; igreja_id: number | null };
};

/**
 * Formulário de pessoa. Valida no navegador para dar retorno imediato, mas a
 * validação que vale é a do servidor (mesmo esquema) e a do banco.
 */
export function PessoaForm({ action, mode, igrejas, pessoa }: Props) {
  const [state, formAction] = useActionState(action, { status: "idle" } as ActionState<Fields>);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [igreja, setIgreja] = useState<string>(() => {
    if (pessoa?.igreja_id) return String(pessoa.igreja_id);
    return igrejas.length === 1 ? String(igrejas[0]!.id) : "";
  });

  // No cadastro, sugere a última igreja usada neste aparelho.
  useEffect(() => {
    if (mode !== "create" || igrejas.length <= 1) return;
    try {
      const salva = window.localStorage.getItem(IGREJA_KEY);
      if (salva && igrejas.some((i) => String(i.id) === salva)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única de preferência local
        setIgreja(salva);
      }
    } catch {
      // armazenamento indisponível: segue sem sugestão
    }
  }, [mode, igrejas]);

  const errors = { ...(state.errors ?? {}), ...clientErrors } as Record<string, string | undefined>;
  // No cadastro, após sucesso, o formulário é recriado (campos limpos).
  const formKey = mode === "create" && state.status === "success" ? `ok-${state.at}` : "form";
  const values = state.status === "error" ? state.values : mode === "edit" ? state.values : undefined;
  const reaberto = state.status === "success" && state.message && !state.message.startsWith("Cadastro realizado");

  return (
    <>
      <form
        key={formKey}
        action={formAction}
        noValidate
        className="grid gap-5"
        onSubmit={(e) => {
          const fd = new FormData(e.currentTarget);
          const parsed = pessoaSchema.safeParse({
            nome: fd.get("nome"),
            numero: fd.get("numero"),
            igrejaId: fd.get("igrejaId"),
          });
          if (!parsed.success) {
            e.preventDefault();
            const errs = fieldErrors(parsed.error);
            setClientErrors(errs);
            const first = Object.keys(errs)[0];
            if (first) (e.currentTarget.elements.namedItem(first) as HTMLElement | null)?.focus();
          } else {
            setClientErrors({});
            try {
              window.localStorage.setItem(IGREJA_KEY, String(parsed.data.igrejaId));
            } catch {
              // ignora
            }
          }
        }}
      >
        {pessoa ? <input type="hidden" name="id" value={pessoa.id} /> : null}

        {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}

        <Field id="igrejaId" label="Igreja" error={errors.igrejaId}>
          <Select
            {...ariaFor("igrejaId", errors.igrejaId)}
            name="igrejaId"
            required
            value={igreja}
            onChange={(e) => {
              setIgreja(e.target.value);
              if (clientErrors.igrejaId) setClientErrors((prev) => omit(prev, "igrejaId"));
            }}
          >
            <option value="" disabled>
              Selecione a igreja
            </option>
            {igrejas.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}
              </option>
            ))}
          </Select>
        </Field>

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

      <Toast
        message={state.status === "success" ? state.message : undefined}
        stamp={state.at}
        duration={reaberto ? 6000 : 3800}
      />
    </>
  );
}
