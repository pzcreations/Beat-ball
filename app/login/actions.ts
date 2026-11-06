"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { homePathFor } from "@/lib/auth";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/utils";
import { fieldErrors, loginSchema } from "@/lib/validation";

type LoginFields = { email: string; senha: string };

/** Aceita apenas caminhos internos (evita redirecionamento aberto). */
function safeNext(next: FormDataEntryValue | null): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (next.startsWith("/login")) return null;
  return next.slice(0, 512);
}

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
}

export async function loginAction(_prev: ActionState<LoginFields>, formData: FormData): Promise<ActionState<LoginFields>> {
  const raw = { email: String(formData.get("email") ?? ""), senha: String(formData.get("senha") ?? "") };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error), values: { email: raw.email }, at: Date.now() };
  }

  const ip = await clientIp();
  const keyIpEmail = `login:${ip}:${parsed.data.email}`;
  const byIpEmail = rateLimit(keyIpEmail, 5, 10 * 60_000);
  const byIp = rateLimit(`login:${ip}`, 30, 10 * 60_000);
  // Independe do IP (que pode ser forjado fora de uma plataforma confiável).
  const byEmail = rateLimit(`login-email:${parsed.data.email}`, 15, 15 * 60_000);
  if (!byIpEmail.ok || !byIp.ok || !byEmail.ok) {
    return {
      status: "error",
      message: "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.",
      values: { email: raw.email },
      at: Date.now(),
    };
  }

  const supabase = await createClient();
  let signIn;
  try {
    signIn = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.senha });
  } catch {
    return {
      status: "error",
      message: "Não foi possível conectar ao servidor de autenticação. Tente novamente.",
      values: { email: raw.email },
      at: Date.now(),
    };
  }

  if (signIn.error || !signIn.data.user) {
    const status = signIn.error?.status;
    const message =
      status === 429
        ? "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente."
        : status && status >= 500
          ? "O serviço de autenticação está indisponível no momento. Tente novamente."
          : // Mensagem genérica: não revela se o e-mail existe.
            "E-mail ou senha incorretos.";
    return { status: "error", message, values: { email: raw.email }, at: Date.now() };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", signIn.data.user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.active) {
    await supabase.auth.signOut({ scope: "local" });
    return {
      status: "error",
      message: profileError
        ? "Não foi possível verificar seu acesso. Tente novamente."
        : "Seu acesso está desativado ou pendente de liberação. Procure o gestor.",
      values: { email: raw.email },
      at: Date.now(),
    };
  }

  resetRateLimit(keyIpEmail);
  await supabase.rpc("registrar_evento", { p_action: "sessao.login" });

  const next = safeNext(formData.get("next"));
  const home = homePathFor(profile);
  // A recepção não é levada a rotas do gestor (e vice-versa não há restrição).
  redirect(next && !(profile.role !== "gestor" && next.startsWith("/gestor")) ? next : home);
}
