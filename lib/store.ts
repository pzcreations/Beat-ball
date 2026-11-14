"use client";

import type { Quote, AuditEntry } from "./types";

const STORAGE_KEY = "compliance360_quotes";

function readAll(): Quote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(quotes: Quote[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  } catch {
    /* storage full — demo still works with in-memory */
  }
}

export function getAllQuotes(): Quote[] {
  return readAll();
}

export function getQuoteById(id: string): Quote | undefined {
  return readAll().find((q) => q.id === id);
}

export function getQuoteByToken(token: string): Quote | undefined {
  return readAll().find((q) => q.token === token);
}

export function saveQuote(quote: Quote): void {
  const all = readAll();
  const idx = all.findIndex((q) => q.id === quote.id);
  if (idx >= 0) {
    all[idx] = quote;
  } else {
    all.push(quote);
  }
  writeAll(all);
}

export function deleteQuote(id: string): void {
  writeAll(readAll().filter((q) => q.id !== id));
}

export function addAuditEntry(quoteId: string, entry: Omit<AuditEntry, "timestamp">): void {
  const all = readAll();
  const quote = all.find((q) => q.id === quoteId);
  if (!quote) return;
  quote.audit.push({ ...entry, timestamp: new Date().toISOString() });
  writeAll(all);
}

export function updateQuoteStatus(quoteId: string, status: Quote["status"]): void {
  const all = readAll();
  const quote = all.find((q) => q.id === quoteId);
  if (!quote) return;
  quote.status = status;
  writeAll(all);
}
