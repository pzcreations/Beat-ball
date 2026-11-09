"use client";

import { useActionState, type ReactNode } from "react";

import { Alert } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { cn, initialActionState, type ActionState } from "@/lib/utils";

/**
 * Formulário genérico ligado a uma Server Action: mostra o erro em linha e a
 * confirmação como aviso discreto. Os campos são passados como filhos.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <>
      <form
        action={formAction}
        className={cn("grid gap-3", className)}
        key={resetOnSuccess && state.status === "success" ? state.at : "f"}
      >
        {state.status === "error" && state.message ? <Alert className="col-span-full">{state.message}</Alert> : null}
        {children}
      </form>
      <Toast message={state.status === "success" ? state.message : undefined} stamp={state.at} />
    </>
  );
}
