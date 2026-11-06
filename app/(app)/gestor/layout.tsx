import type { ReactNode } from "react";

import { requireGestor } from "@/lib/auth";

/**
 * Área administrativa. Alterar a URL não basta para entrar: o papel é lido do
 * banco a cada requisição, cada Server Action repete a verificação e o RLS
 * nega as operações no banco para quem não é gestor.
 */
export default async function GestorLayout({ children }: { children: ReactNode }) {
  await requireGestor();
  return children;
}
