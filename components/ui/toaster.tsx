"use client";

import { useSyncExternalStore } from "react";

import { Toast } from "@/components/ui/toast";

type Aviso = { message: string; tone: "success" | "error"; at: number };

let atual: Aviso | null = null;
const ouvintes = new Set<() => void>();

/**
 * Mostra um aviso global. Útil quando o componente que disparou a ação pode
 * sumir da tela (ex.: o cartão muda de etapa e sai da lista).
 */
export function notify(message: string, tone: "success" | "error" = "success") {
  atual = { message, tone, at: Date.now() };
  ouvintes.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/** Área de avisos globais (montada uma vez no layout autenticado). */
export function Toaster() {
  const aviso = useSyncExternalStore(
    subscribe,
    () => atual,
    () => null,
  );
  return <Toast message={aviso?.message} tone={aviso?.tone} stamp={aviso?.at} />;
}
