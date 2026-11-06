import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Executa antes de cada página:
 *  1. Renova a sessão do Supabase (cookies httpOnly) quando necessário.
 *  2. Redireciona visitantes não autenticados para /login.
 *  3. Gera um nonce por requisição e aplica a Content-Security-Policy.
 *
 * IMPORTANTE: isto é apenas a primeira barreira. A autorização real (papel,
 * usuário ativo, permissões) é verificada no servidor (lib/auth.ts) em cada
 * página e ação, e novamente no banco de dados pelas políticas RLS.
 */

const PUBLIC_PATHS = ["/login"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Estilos inline são de baixo risco e usados pelo próprio Next.js.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // O navegador só conversa com este servidor (nunca diretamente com o Supabase).
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  const cookiesToApply: { name: string; value: string; options: Record<string, unknown> }[] = [];
  const headersToApply: Record<string, string> = {};
  let authenticated = false;
  let roleRedirect: string | null = null;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            cookiesToApply.push({ name, value, options: options as Record<string, unknown> });
          }
          Object.assign(headersToApply, headers ?? {});
        },
      },
    });

    try {
      // Valida o JWT (assinatura/expiração) e renova a sessão se preciso.
      const { data } = await supabase.auth.getClaims();
      const sub = data?.claims?.sub;
      authenticated = Boolean(sub);

      // Área administrativa: bloqueia antes de qualquer renderização.
      // (As páginas, as Server Actions e o RLS repetem esta verificação.)
      if (sub && request.nextUrl.pathname.startsWith("/gestor")) {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role, active")
          .eq("id", sub)
          .maybeSingle();
        if (!error) {
          if (!profile?.active) roleRedirect = "/login?erro=inativo";
          else if (profile.role !== "gestor") roleRedirect = "/inicio";
        }
      }
    } catch {
      authenticated = false;
    }
  }

  const { pathname, search } = request.nextUrl;

  if (authenticated && roleRedirect) {
    const redirect = NextResponse.redirect(new URL(roleRedirect, request.url));
    redirect.headers.set("Content-Security-Policy", csp);
    for (const c of cookiesToApply) redirect.cookies.set(c.name, c.value, c.options);
    return redirect;
  }

  if (!authenticated && !isPublic(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(loginUrl);
    redirect.headers.set("Content-Security-Policy", csp);
    for (const c of cookiesToApply) redirect.cookies.set(c.name, c.value, c.options);
    return redirect;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  for (const c of cookiesToApply) response.cookies.set(c.name, c.value, c.options);
  for (const [k, v] of Object.entries(headersToApply)) response.headers.set(k, v);
  return response;
}

export const config = {
  matcher: [
    // Tudo, exceto arquivos estáticos, ícones, manifest, service worker e página offline.
    "/((?!_next/static|_next/image|icons/|favicon.ico|manifest.webmanifest|sw.js|offline.html|robots.txt).*)",
  ],
};
