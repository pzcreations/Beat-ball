import "server-only";

/**
 * Leitura centralizada das variáveis de ambiente do servidor.
 * Falha cedo, com mensagem clara, se algo obrigatório não estiver configurado.
 */
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Consulte .env.example e o README.`,
    );
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("SUPABASE_URL");
  },
  get supabasePublishableKey() {
    return process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || required("SUPABASE_ANON_KEY");
  },
  get supabaseSecretKey() {
    return process.env.SUPABASE_SECRET_KEY?.trim() || required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get timezone() {
    return process.env.APP_TIMEZONE?.trim() || "America/Sao_Paulo";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};
