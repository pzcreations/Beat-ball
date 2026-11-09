"use client";

import { CalendarDays, Ellipsis, Filter, History, House, LayoutDashboard, Search, Settings, ShieldCheck, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavIcon, NavItem } from "@/components/app-shell/nav-items";
import { cn } from "@/lib/utils";

const ICONS: Record<NavIcon, typeof House> = {
  home: House,
  plus: UserPlus,
  search: Search,
  dashboard: LayoutDashboard,
  users: Users,
  team: ShieldCheck,
  history: History,
  funnel: Filter,
  settings: Settings,
  more: Ellipsis,
  calendar: CalendarDays,
};

function useIsActive() {
  const pathname = usePathname();
  const match = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (item: NavItem) =>
    (item.exact ? pathname === item.href : match(item.href)) || (item.also ?? []).some(match);
}

/** Navegação lateral (tablet/desktop). */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const isActive = useIsActive();
  return (
    <nav aria-label="Navegação principal" className="grid gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              active ? "bg-azure-100 text-navy-900" : "text-muted hover:bg-azure-50 hover:text-navy-900",
            )}
          >
            <Icon className={cn("size-[18px]", active ? "text-navy-800" : "text-subtle group-hover:text-navy-700")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra inferior estilo aplicativo (celular). */
export function BottomNav({ items }: { items: NavItem[] }) {
  const isActive = useIsActive();
  return (
    <nav
      aria-label="Navegação principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 md:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(item);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-navy-900" : "text-subtle active:text-navy-700",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors",
                    active ? "bg-azure-100" : "bg-transparent",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.2 : 1.9} aria-hidden />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
