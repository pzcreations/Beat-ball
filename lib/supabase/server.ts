import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

/**
 * Opções dos cookies de sessão.
 *
 * O navegador NUNCA fala diretamente com o Supabase: todas as chamadas partem
 * do servidor Next.js (padrão Backend-for-Frontend). Por isso os cookies podem
 * ser httpOnly — os tokens ficam inacessíveis a JavaScript, o que neutraliza o
 * roubo de sessão via XSS. SameSite=Lax + verificação de Origin das Server
 * Actions protegem contra CSRF.
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax" as const,
    path: "/",
  };
}

/** Cliente Supabase em nome do usuário logado (sujeito a RLS). */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado a partir de um Server Component (sem permissão de escrita de
          // cookies). O proxy.ts já renova a sessão a cada requisição.
        }
      },
    },
  });
}

/**
 * Cliente administrativo (service role) — IGNORA o RLS.
 * Só pode ser usado em código de servidor, DEPOIS de verificar que o usuário
 * atual é gestor (ver lib/auth.ts → requireGestor). Nunca importar em
 * componentes cliente: o pacote "server-only" quebra o build se isso ocorrer.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
