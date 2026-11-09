"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Portal } from "@/components/ui/portal";
import { cn } from "@/lib/utils";

type ToastProps = {
  /** Texto exibido; quando muda (com `stamp` novo), o aviso reaparece. */
  message?: string;
  tone?: "success" | "error";
  /** Identificador do evento (ex.: horário do envio). */
  stamp?: number;
  duration?: number;
};

/**
 * Aviso discreto e temporário, anunciado a leitores de tela (aria-live).
 * No celular aparece no topo, sem cobrir botões nem a navegação.
 */
export function Toast({ message, tone = "success", stamp, duration = 3800 }: ToastProps) {
  const [dismissed, setDismissed] = useState<number | undefined>(undefined);
  const [expired, setExpired] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!message || stamp === undefined) return;
    const t = setTimeout(() => setExpired(stamp), duration);
    return () => clearTimeout(t);
  }, [message, stamp, duration]);

  const visible = Boolean(message) && stamp !== undefined && dismissed !== stamp && expired !== stamp;

  return (
    <Portal>
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(64px+env(safe-area-inset-top))] z-50 flex justify-center px-4 md:top-auto md:bottom-6"
    >
      {visible ? (
        <div
          key={stamp}
          role="status"
          className={cn(
            "pointer-events-auto flex w-full max-w-sm animate-toast items-center gap-3 rounded-lg border bg-white px-4 py-3 text-sm shadow-pop",
            tone === "success" ? "border-[#cfe9da]" : "border-[#f6d3cf]",
          )}
        >
          {tone === "success" ? (
            <CircleCheck className="size-5 shrink-0 text-success" aria-hidden />
          ) : (
            <CircleAlert className="size-5 shrink-0 text-danger" aria-hidden />
          )}
          <p className="flex-1 font-medium text-navy-900">{message}</p>
          <button
            type="button"
            onClick={() => setDismissed(stamp)}
            className="-mr-1 grid size-8 place-items-center rounded-md text-muted hover:bg-azure-50"
            aria-label="Fechar aviso"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
    </Portal>
  );
}
