"use client";

import { useEffect } from "react";

/** Registra o service worker (somente em produção e em contexto seguro). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sem service worker o sistema continua funcionando normalmente.
    });
  }, []);
  return null;
}
