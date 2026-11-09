"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const noop = () => () => {};

/**
 * Renderiza os filhos direto no <body>. Usado por diálogos e avisos para que
 * a posição na tela não dependa de transformações/animações dos ancestrais.
 */
export function Portal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return mounted ? createPortal(children, document.body) : null;
}
