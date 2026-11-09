import type { AppRole } from "@/lib/database.types";

export type NavIcon =
  | "home"
  | "plus"
  | "search"
  | "dashboard"
  | "users"
  | "team"
  | "history"
  | "funnel"
  | "settings"
  | "more";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Ativo apenas quando o caminho é exatamente igual. */
  exact?: boolean;
  /** Rotas adicionais que também marcam este item como ativo. */
  also?: string[];
};

/**
 * Itens de navegação por perfil. Isto controla apenas o que é EXIBIDO;
 * o acesso é verificado no servidor (lib/auth.ts) e no banco (RLS).
 *  - sidebar: menu lateral (tablet/desktop), com todos os itens;
 *  - bottom: barra inferior do celular (no máximo 5 itens).
 */
export function navItemsFor(role: AppRole): { sidebar: NavItem[]; bottom: NavItem[] } {
  if (role === "gestor") {
    const painel: NavItem = { href: "/gestor", label: "Painel", icon: "dashboard", exact: true };
    const atendimentos: NavItem = { href: "/gestor/atendimentos", label: "Atendimentos", icon: "funnel" };
    const cadastros: NavItem = { href: "/gestor/cadastros", label: "Cadastros", icon: "users" };
    const cadastrar: NavItem = { href: "/cadastrar", label: "Cadastrar", icon: "plus" };
    const equipe: NavItem = { href: "/gestor/usuarios", label: "Equipe", icon: "team" };
    const historico: NavItem = { href: "/gestor/historico", label: "Histórico", icon: "history" };
    const config: NavItem = { href: "/gestor/configuracoes", label: "Configurações", icon: "settings" };
    return {
      sidebar: [painel, atendimentos, cadastros, cadastrar, equipe, historico, config],
      bottom: [
        painel,
        atendimentos,
        cadastrar,
        cadastros,
        {
          href: "/gestor/mais",
          label: "Mais",
          icon: "more",
          also: ["/gestor/usuarios", "/gestor/historico", "/gestor/configuracoes", "/conta"],
        },
      ],
    };
  }
  const items: NavItem[] = [
    { href: "/inicio", label: "Início", icon: "home", exact: true },
    { href: "/cadastrar", label: "Cadastrar", icon: "plus" },
    { href: "/consulta", label: "Consulta", icon: "search" },
  ];
  return { sidebar: items, bottom: items };
}
