"use client";

import Link from "next/link";
import { Snowflake, LayoutDashboard } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 glass">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon-cyan/10 border border-neon-cyan/20">
            <Snowflake className="h-5 w-5 text-neon-cyan" />
          </div>
          <div>
            <h1 className="font-display text-2xl leading-none tracking-wider text-text-primary">
              COMPLIANCE 360
            </h1>
            <p className="text-[10px] text-text-muted tracking-widest uppercase">
              ACC Ar Condicionados
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/painel"
            className="flex items-center gap-2 rounded-lg border border-border bg-dark-800 px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:border-dark-400 transition-all"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Painel de Conformidade</span>
            <span className="sm:hidden">Painel</span>
          </Link>
          <span className="hidden items-center gap-1.5 rounded-full bg-neon-green/10 px-3 py-1 text-xs text-neon-green border border-neon-green/20 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-neon-green animate-pulse" />
            Ativo
          </span>
        </div>
      </div>
    </header>
  );
}
