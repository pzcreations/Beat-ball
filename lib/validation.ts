import { z } from "zod";

/**
 * Esquemas de validação compartilhados entre navegador (experiência) e
 * servidor (segurança). O servidor SEMPRE revalida; o banco ainda aplica
 * CHECK constraints como última barreira.
 */

const collapseSpaces = (v: string) => v.replace(/\s+/g, " ").trim();

export const nomeSchema = z
  .string({ error: "Informe o nome." })
  .transform(collapseSpaces)
  .pipe(
    z
      .string()
      .min(3, "O nome deve ter pelo menos 3 caracteres.")
      .max(120, "O nome deve ter no máximo 120 caracteres.")
      .regex(/^[\p{L}][\p{L}\p{M} .'’-]*$/u, "Use apenas letras, espaços, apóstrofo, ponto ou hífen."),
  );

/** Aceita máscaras como "(11) 98765-4321" e guarda apenas os dígitos. */
export const numeroSchema = z
  .string({ error: "Informe o número." })
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(
    z
      .string()
      .min(3, "O número deve ter pelo menos 3 dígitos.")
      .max(20, "O número deve ter no máximo 20 dígitos."),
  );

export const igrejaIdSchema = z.coerce
  .number({ error: "Selecione a igreja." })
  .int("Selecione a igreja.")
  .min(1, "Selecione a igreja.")
  .max(32_767, "Selecione a igreja.");

export const pessoaSchema = z.object({
  nome: nomeSchema,
  numero: numeroSchema,
  igrejaId: igrejaIdSchema,
});

export type PessoaInput = z.infer<typeof pessoaSchema>;

// Formato 8-4-4-4-12 (o banco valida o tipo uuid de qualquer forma).
export const uuidSchema = z
  .string({ error: "Identificador inválido." })
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Identificador inválido.");

export const emailSchema = z
  .string({ error: "Informe o e-mail." })
  .trim()
  .toLowerCase()
  .pipe(z.string().email("E-mail inválido.").max(254));

/** Política de senha: mínimo 10 caracteres, com letras e números. */
export const senhaSchema = z
  .string({ error: "Informe a senha." })
  .min(10, "A senha deve ter pelo menos 10 caracteres.")
  .max(72, "A senha deve ter no máximo 72 caracteres.")
  .regex(/[A-Za-z]/, "A senha deve conter letras.")
  .regex(/[0-9]/, "A senha deve conter números.");

export const fullNameSchema = z
  .string({ error: "Informe o nome." })
  .transform(collapseSpaces)
  .pipe(
    z
      .string()
      .min(2, "O nome deve ter pelo menos 2 caracteres.")
      .max(120, "O nome deve ter no máximo 120 caracteres.")
      .regex(/^[^\p{Cc}]+$/u, "Nome inválido."),
  );

export const roleSchema = z.enum(["recepcao", "gestor"], { error: "Perfil inválido." });

export const novoUsuarioSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  senha: senhaSchema,
  role: roleSchema,
  canViewRecords: z.boolean(),
});

export const editarUsuarioSchema = z.object({
  id: uuidSchema,
  fullName: fullNameSchema,
  role: roleSchema,
  canViewRecords: z.boolean(),
  active: z.boolean(),
});

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, "Informe a senha.").max(72),
});

/** Filtros da listagem de cadastros (vindos da URL — nunca confiáveis). */
export const filtrosSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  periodo: z.enum(["hoje", "7d", "30d", "mes", "todos"]).optional().catch(undefined),
  ordem: z.enum(["recentes", "antigos", "nome"]).optional().catch(undefined),
  pagina: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
  responsavel: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .optional()
    .catch(undefined),
  igreja: z.coerce.number().int().min(1).max(32_767).optional().catch(undefined),
  etapa: z.coerce.number().int().min(1).max(32_767).optional().catch(undefined),
});

export type Filtros = z.infer<typeof filtrosSchema>;

/** Converte erros do Zod em { campo: mensagem } para exibir no formulário. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Remove acentos e caixa para busca (espelha a coluna nome_busca). */
export function normalizeSearch(v: string) {
  return v
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Escapa curingas do LIKE/ILIKE para que o texto seja tratado literalmente. */
export function escapeLike(v: string) {
  return v.replace(/[\\%_*]/g, (c) => (c === "*" ? "" : `\\${c}`));
}
