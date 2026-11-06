"use client";

import { useEffect, useState } from "react";

import { Toast } from "@/components/ui/toast";

/**
 * Exibe uma mensagem vinda de um redirecionamento (?msg=...) e limpa o
 * parâmetro da URL. Apenas chaves conhecidas são aceitas — o texto exibido
 * nunca vem da URL.
 */
const MESSAGES: Record<string, string> = {
  excluido: "Cadastro excluído.",
  criado: "Usuário criado com sucesso.",
};

export function FlashToast({ msg }: { msg?: string }) {
  const [stamp] = useState(() => Date.now());
  const message = msg ? MESSAGES[msg] : undefined;

  useEffect(() => {
    if (!message) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("msg");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [message]);

  return <Toast message={message} stamp={message ? stamp : undefined} />;
}
