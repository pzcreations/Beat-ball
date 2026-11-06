"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Logout seguro: registra o evento, revoga no Supabase o refresh token desta
 * sessão e remove os cookies. Só aceita POST (Server Action), com verificação
 * de origem feita pelo Next.js.
 */
export async function signOutAction() {
  const supabase = await createClient();
  try {
    await supabase.rpc("registrar_evento", { p_action: "sessao.logout" });
  } catch {
    // Falha no registro não deve impedir a saída.
  }
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?saiu=1");
}
