import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import type { AppRole } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  canViewRecords: boolean;
  active: boolean;
};

export class ConnectionError extends Error {
  constructor() {
    super("Não foi possível conectar ao banco de dados. Tente novamente em instantes.");
    this.name = "ConnectionError";
  }
}

/**
 * Usuário atual, lido do BANCO (perfil, papel e status), nunca de dados
 * enviados pelo navegador. Memoizado por requisição.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, can_view_records, active")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new ConnectionError();
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    canViewRecords: profile.can_view_records,
    active: profile.active,
  };
});

/** Exige usuário autenticado e ativo. Use em toda página e Server Action. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.active) redirect("/login?erro=inativo");
  return user;
}

/** Exige perfil de gestor. A mesma regra é imposta no banco (RLS). */
export async function requireGestor(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "gestor") redirect("/inicio");
  return user;
}

export function homePathFor(user: Pick<CurrentUser, "role">) {
  return user.role === "gestor" ? "/gestor" : "/inicio";
}
