/** Formatação para exibição (pt-BR). Seguro para servidor e cliente. */

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Sao_Paulo";

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDateTime(iso: string) {
  return dateTimeFmt.format(new Date(iso)).replace(",", " às");
}

export function formatDate(iso: string) {
  return dateFmt.format(new Date(iso));
}

/** "Hoje às 14:32", "Ontem às 09:10" ou "12/10/2026 às 08:00". */
export function formatRelative(iso: string, now = new Date()) {
  const d = new Date(iso);
  const key = dayKeyFmt.format(d);
  const today = dayKeyFmt.format(now);
  const yesterday = dayKeyFmt.format(new Date(now.getTime() - 86_400_000));
  if (key === today) return `Hoje às ${timeFmt.format(d)}`;
  if (key === yesterday) return `Ontem às ${timeFmt.format(d)}`;
  return formatDateTime(iso);
}

/** Formata telefones brasileiros; demais identificações ficam como estão. */
export function formatNumero(numero: string) {
  if (/^\d{11}$/.test(numero)) return `(${numero.slice(0, 2)}) ${numero.slice(2, 7)}-${numero.slice(7)}`;
  if (/^\d{10}$/.test(numero)) return `(${numero.slice(0, 2)}) ${numero.slice(2, 6)}-${numero.slice(6)}`;
  if (/^\d{9}$/.test(numero)) return `${numero.slice(0, 5)}-${numero.slice(5)}`;
  if (/^\d{8}$/.test(numero)) return `${numero.slice(0, 4)}-${numero.slice(4)}`;
  return numero;
}

export function formatInt(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export const ROLE_LABEL = { recepcao: "Recepção", gestor: "Gestor" } as const;
