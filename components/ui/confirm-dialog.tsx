"use client";

import { TriangleAlert } from "lucide-react";
import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState, type ActionState } from "@/lib/utils";

type ConfirmDialogProps = {
  /** Conteúdo do botão que abre a confirmação. */
  trigger: ReactNode;
  triggerVariant?: "danger" | "danger-outline" | "outline" | "ghost";
  triggerSize?: "sm" | "md" | "icon" | "icon-sm";
  triggerLabel?: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Campos ocultos enviados com a confirmação (ex.: id). */
  fields: Record<string, string>;
};

/**
 * Confirmação obrigatória antes de ações destrutivas.
 * Usa o <dialog> nativo (foco preso, Esc para fechar, acessível).
 */
export function ConfirmDialog({
  trigger,
  triggerVariant = "danger-outline",
  triggerSize = "md",
  triggerLabel,
  title,
  description,
  confirmLabel,
  action,
  fields,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction] = useActionState(action, initialActionState);

  useEffect(() => {
    if (state.status === "success") ref.current?.close();
  }, [state]);

  return (
    <>
      <Button
        variant={triggerVariant}
        size={triggerSize}
        aria-label={triggerLabel}
        onClick={() => ref.current?.showModal()}
      >
        {trigger}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-white p-0 text-ink shadow-pop open:animate-toast"
      >
        <form action={formAction} className="p-5">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <div className="flex gap-3.5">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-danger-bg text-danger">
              <TriangleAlert className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-navy-900">
                {title}
              </h2>
              <div className="mt-1 text-sm text-muted">{description}</div>
            </div>
          </div>
          {state.status === "error" && state.message ? (
            <Alert className="mt-4">{state.message}</Alert>
          ) : null}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => ref.current?.close()}>
              Cancelar
            </Button>
            <SubmitButton variant="danger" pendingLabel="Excluindo…">
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
