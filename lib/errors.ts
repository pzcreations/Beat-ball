import "server-only";

type DbError = { code?: string; message?: string } | null | undefined;

/**
 * Traduz erros do banco/API em mensagens seguras para o usuário, sem expor
 * detalhes internos. Registra no log do servidor apenas o código técnico
 * (nunca dados pessoais).
 */
export function friendlyDbError(error: DbError, context: string): string {
  const code = error?.code ?? "desconhecido";
  console.error(`[recepcao] ${context}: código ${code}`);

  switch (code) {
    case "42501":
      return "Você não tem permissão para realizar esta ação.";
    case "23514":
    case "22P02":
    case "23502":
      return "Os dados informados são inválidos. Revise os campos.";
    case "23503":
      return "Este registro está vinculado a outros dados e não pode ser removido.";
    case "23505":
      return "Já existe um registro com estes dados.";
    case "P0001":
      // Mensagens de regra de negócio escritas por nós no banco (seguras).
      return error?.message ?? "Operação não permitida.";
    case "PGRST301":
    case "PGRST303":
      return "Sua sessão expirou. Entre novamente.";
    default:
      return "Não foi possível concluir a operação. Verifique sua conexão e tente novamente.";
  }
}
