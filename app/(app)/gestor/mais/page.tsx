import { ChevronRight, History, LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { signOutAction } from "@/app/actions/session";
import { Card, PageHeader } from "@/components/ui/card";
import { requireGestor } from "@/lib/auth";

export const metadata: Metadata = { title: "Mais" };

const LINKS = [
  { href: "/gestor/usuarios", label: "Equipe", desc: "Usuários, perfis e permissões", icon: ShieldCheck },
  { href: "/gestor/historico", label: "Histórico", desc: "Atividades e alterações registradas", icon: History },
  { href: "/gestor/configuracoes", label: "Configurações", desc: "Etapas, igrejas e mensagem do WhatsApp", icon: Settings },
  { href: "/conta", label: "Minha conta", desc: "Nome, senha e sessão", icon: UserRound },
];

/** Menu complementar do gestor no celular. */
export default async function MaisPage() {
  await requireGestor();
  return (
    <div className="mx-auto grid max-w-xl gap-5">
      <PageHeader title="Mais" />
      <Card className="animate-enter overflow-hidden">
        <ul className="divide-y divide-line">
          {LINKS.map(({ href, label, desc, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="flex items-center gap-3.5 px-4 py-4 active:bg-azure-50 md:px-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-azure-50 text-navy-700">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-navy-900">{label}</span>
                  <span className="block text-sm text-muted">{desc}</span>
                </span>
                <ChevronRight className="size-4 text-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <form action={signOutAction}>
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-line bg-white text-[15px] font-medium text-danger hover:bg-danger-bg"
        >
          <LogOut className="size-[18px]" aria-hidden /> Sair do sistema
        </button>
      </form>
    </div>
  );
}
