/**
 * Cálculo de limites de período no fuso horário da operação
 * (ex.: "hoje" em São Paulo começa às 00:00 de São Paulo, não às 00:00 UTC).
 */

function offsetMinutes(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUtc - date.getTime()) / 60_000;
}

function zonedYmd(date: Date, tz: string) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .split("-")
    .map(Number);
  return { y: y ?? 1970, m: m ?? 1, d: d ?? 1 };
}

function zonedMidnight(y: number, m: number, d: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - offsetMinutes(new Date(guess), tz) * 60_000;
  // Segunda passada corrige transições de horário de verão.
  return new Date(guess - offsetMinutes(new Date(first), tz) * 60_000);
}

/** Início do dia (00:00 no fuso) de `daysAgo` dias atrás. */
export function startOfZonedDay(tz: string, daysAgo = 0, now = new Date()) {
  const { y, m, d } = zonedYmd(now, tz);
  return zonedMidnight(y, m, d - daysAgo, tz);
}

/** Início do mês corrente no fuso. */
export function startOfZonedMonth(tz: string, now = new Date()) {
  const { y, m } = zonedYmd(now, tz);
  return zonedMidnight(y, m, 1, tz);
}

export type Periodo = "hoje" | "7d" | "30d" | "mes" | "todos";

export function periodoStart(periodo: Periodo | undefined, tz: string): Date | null {
  switch (periodo) {
    case "hoje":
      return startOfZonedDay(tz, 0);
    case "7d":
      return startOfZonedDay(tz, 6);
    case "30d":
      return startOfZonedDay(tz, 29);
    case "mes":
      return startOfZonedMonth(tz);
    default:
      return null;
  }
}

export const PERIODO_LABEL: Record<Periodo, string> = {
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  mes: "Este mês",
  todos: "Todo o período",
};

/** Converte data (AAAA-MM-DD) + hora (HH:MM) no fuso informado para UTC. */
export function zonedToUtc(data: string, hora: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  const h = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!m || !h) return null;
  const [y, mo, d, hh, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(h[1]), Number(h[2])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mi > 59) return null;
  const guess = Date.UTC(y, mo - 1, d, hh, mi);
  const first = guess - offsetMinutes(new Date(guess), tz) * 60_000;
  return new Date(guess - offsetMinutes(new Date(first), tz) * 60_000);
}
