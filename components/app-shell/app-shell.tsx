import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { signOutAction } from "@/app/actions/session";
import { navItemsFor } from "@/components/app-shell/nav-items";
import { BottomNav, SidebarNav } from "@/components/app-shell/nav-links";
import { BrandLockup, BrandMark } from "@/components/brand";
import type { CurrentUser } from "@/lib/auth";
import { ROLE_LABEL, initials } from "@/lib/format";

function Avatar({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid size-9 shrink-0 place-items-center rounded-full bg-azure-100 text-[13px] font-semibold text-navy-800 ${className}`}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Estrutura comum das telas autenticadas:
 *  - celular: cabeçalho compacto + barra de navegação inferior (estilo app);
 *  - tablet/desktop: menu lateral fixo.
 */
export function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const items = navItemsFor(user.role);
  const homeHref = items[0]?.href ?? "/";

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      {/* Menu lateral (md+) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-white md:flex">
        <Link href={homeHref} className="flex h-16 items-center border-b border-line px-5">
          <BrandLockup subtitle={user.role === "gestor" ? "Gestão" : "Atendimento"} />
        </Link>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav items={items} />
        </div>
        <div className="border-t border-line p-3">
          <Link
            href="/conta"
            className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-azure-50"
          >
            <Avatar name={user.fullName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-navy-900">{user.fullName}</p>
              <p className="text-xs text-muted">{ROLE_LABEL[user.role]}</p>
            </div>
            <Settings className="size-4 text-subtle" aria-label="Configurações da conta" />
          </Link>
          <form action={signOutAction} className="mt-1">
            <button
              type="submit"
              className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted transition-colors hover:bg-azure-50 hover:text-navy-900"
            >
              <LogOut className="size-[18px]" aria-hidden />
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        {/* Cabeçalho (celular) */}
        <header className="pt-safe sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 md:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href={homeHref} className="flex items-center gap-2.5" aria-label="Recepção — página inicial">
              <BrandMark className="size-7" />
              <span className="text-[15px] font-semibold tracking-tight text-navy-900">Recepção</span>
            </Link>
            <Link href="/conta" aria-label="Minha conta" className="rounded-full">
              <Avatar name={user.fullName} className="size-8 text-xs" />
            </Link>
          </div>
        </header>

        <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>

      <BottomNav items={items} />
    </div>
  );
}
