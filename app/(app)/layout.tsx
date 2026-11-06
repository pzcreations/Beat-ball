import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { requireUser } from "@/lib/auth";

/** Todas as telas internas exigem usuário autenticado e ATIVO (verificado no banco). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
