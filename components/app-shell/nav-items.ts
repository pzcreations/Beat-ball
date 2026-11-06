import type { AppRole } from "@/lib/database.types";

export type NavIcon = "home" | "plus" | "search" | "dashboard" | "users" | "team" | "history";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Ativo apenas quando o caminho é exatamente igual. */
  exact?: boolean;
};

/**
 * Itens de navegação por perfil. Isto controla apenas o que é EXIBIDO;
 * o acesso é verificado no servidor (lib/auth.ts) e no banco (RLS).
 */
export function navItemsFor(role: AppRole): NavItem[] {
  if (role === "gestor") {
    return [
      { href: "/gestor", label: "Painel", icon: "dashboard", exact: true },
      { href: "/gestor/cadastros", label: "Cadastros", icon: "users" },
      { href: "/cadastrar", label: "Cadastrar", icon: "plus" },
      { href: "/gestor/usuarios", label: "Equipe", icon: "team" },
      { href: "/gestor/historico", label: "Histórico", icon: "history" },
    ];
  }
  return [
    { href: "/inicio", label: "Início", icon: "home", exact: true },
    { href: "/cadastrar", label: "Cadastrar", icon: "plus" },
    { href: "/consulta", label: "Consulta", icon: "search" },
  ];
}
