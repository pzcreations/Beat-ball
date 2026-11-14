"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Snowflake,
  Eye,
  Trash2,
  History,
} from "lucide-react";
import { getAllQuotes, deleteQuote, saveQuote } from "@/lib/store";
import { type Quote, formatDateBR, formatDateTimeBR, isExpired } from "@/lib/types";

const STATUS_CONFIG = {
  rascunho: { label: "Rascunho", icon: FileText, color: "text-text-muted", bg: "bg-dark-600" },
  enviado: { label: "Enviado", icon: Send, color: "text-neon-blue", bg: "bg-neon-blue/10" },
  aprovado: { label: "Aprovado", icon: CheckCircle, color: "text-neon-green", bg: "bg-neon-green/10" },
  recusado: { label: "Recusado", icon: XCircle, color: "text-danger", bg: "bg-danger/10" },
  vencido: { label: "Vencido", icon: Clock, color: "text-warning", bg: "bg-warning/10" },
};

export default function PainelPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  useEffect(() => {
    refreshQuotes();
  }, []);

  function refreshQuotes() {
    const all = getAllQuotes();
    for (const q of all) {
      if (q.status === "enviado" && isExpired(q.validUntil)) {
        q.status = "vencido";
        saveQuote(q);
      }
    }
    setQuotes(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }

  function handleDelete(id: string) {
    deleteQuote(id);
    setSelectedQuote(null);
    refreshQuotes();
  }

  const totalQuotes = quotes.length;
  const approved = quotes.filter((q) => q.status === "aprovado").length;
  const pending = quotes.filter((q) => q.status === "enviado").length;
  const refused = quotes.filter((q) => q.status === "recusado").length;
  const expired = quotes.filter((q) => q.status === "vencido").length;
  const noServiceWithoutAccept = quotes.every(
    (q) => q.osStatus === "aguardando_aprovacao" || q.status === "aprovado"
  );

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <header className="sticky top-0 z-50 glass">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon-cyan/10 border border-neon-cyan/20">
                <Snowflake className="h-5 w-5 text-neon-cyan" />
              </div>
              <div>
                <h1 className="font-display text-2xl leading-none tracking-wider text-text-primary">
                  COMPLIANCE 360
                </h1>
                <p className="text-[10px] text-text-muted tracking-widest uppercase">
                  Painel de Conformidade
                </p>
              </div>
            </Link>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg border border-border bg-dark-800 px-3 py-2 text-xs text-text-secondary hover:text-text-primary transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Novo Orçamento
          </Link>
        </div>
      </header>

      <main className="px-4 pb-8 pt-6 lg:px-8">
        <div className="mx-auto max-w-[1400px]">
          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-border bg-dark-900 p-4">
              <p className="text-xs text-text-muted">Total</p>
              <p className="mt-1 text-2xl font-bold tabular text-text-primary">{totalQuotes}</p>
            </div>
            <div className="rounded-xl border border-neon-blue/20 bg-neon-blue/5 p-4">
              <p className="text-xs text-neon-blue">Enviados</p>
              <p className="mt-1 text-2xl font-bold tabular text-neon-blue">{pending}</p>
            </div>
            <div className="rounded-xl border border-neon-green/20 bg-neon-green/5 p-4">
              <p className="text-xs text-neon-green">Aprovados</p>
              <p className="mt-1 text-2xl font-bold tabular text-neon-green">{approved}</p>
            </div>
            <div className="rounded-xl border border-danger/20 bg-danger/5 p-4">
              <p className="text-xs text-danger">Recusados</p>
              <p className="mt-1 text-2xl font-bold tabular text-danger">{refused}</p>
            </div>
            <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
              <p className="text-xs text-warning">Vencidos</p>
              <p className="mt-1 text-2xl font-bold tabular text-warning">{expired}</p>
            </div>
            <div className={`rounded-xl border p-4 ${
              noServiceWithoutAccept
                ? "border-neon-green/20 bg-neon-green/5"
                : "border-danger/20 bg-danger/5"
            }`}>
              <p className="text-xs text-text-muted">Conformidade</p>
              <div className="mt-1 flex items-center gap-1.5">
                {noServiceWithoutAccept ? (
                  <>
                    <ShieldCheck className="h-5 w-5 text-neon-green" />
                    <span className="text-sm font-bold text-neon-green">OK</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-danger" />
                    <span className="text-sm font-bold text-danger">ALERTA</span>
                  </>
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-text-muted">
                {noServiceWithoutAccept
                  ? "Nenhum serviço sem aceite"
                  : "Serviço iniciado sem aceite!"}
              </p>
            </div>
          </div>

          {/* Quote list */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">
            <div className="rounded-xl border border-border bg-dark-900">
              <div className="border-b border-border px-4 py-3">
                <h2 className="font-display text-lg tracking-wider text-text-primary">
                  ORÇAMENTOS
                </h2>
              </div>

              {quotes.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <FileText className="h-10 w-10 text-text-muted" />
                  <p className="text-sm text-text-secondary">Nenhum orçamento registrado</p>
                  <Link
                    href="/"
                    className="mt-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 px-4 py-2 text-sm text-neon-cyan hover:bg-neon-cyan/20 transition-all"
                  >
                    Criar Primeiro Orçamento
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {quotes.map((q) => {
                    const cfg = STATUS_CONFIG[q.status];
                    const Icon = cfg.icon;
                    const version = q.versions[q.currentVersion - 1]!;
                    const itemsTotal = version.items.reduce((acc, i) => acc + i.total, 0);
                    const sub = itemsTotal + version.laborCost + version.equipmentCost;
                    const disc = sub * (version.discount / 100);
                    const tot = sub - disc;

                    return (
                      <button
                        key={q.id}
                        onClick={() => setSelectedQuote(q)}
                        className={`flex w-full items-center gap-4 px-4 py-3 text-left transition-all hover:bg-surface-hover ${
                          selectedQuote?.id === q.id ? "bg-surface-hover" : ""
                        }`}
                      >
                        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                          <Icon className={`h-4 w-4 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary truncate">
                              {q.client.name || "—"}
                            </span>
                            <span className={`text-[10px] font-semibold ${cfg.color}`}>
                              {cfg.label.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-text-muted truncate">
                            {q.client.vehicle} — {q.id}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold tabular text-text-primary">
                            R$ {tot.toFixed(2)}
                          </p>
                          <p className="text-[10px] text-text-muted">
                            {formatDateBR(q.createdAt)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Detail panel */}
            {selectedQuote ? (
              <QuoteDetail
                quote={selectedQuote}
                onDelete={(id) => handleDelete(id)}
                onRefresh={refreshQuotes}
              />
            ) : (
              <div className="hidden xl:flex rounded-xl border border-border bg-dark-900 items-center justify-center p-8 text-center">
                <div>
                  <Eye className="mx-auto h-8 w-8 text-text-muted" />
                  <p className="mt-3 text-sm text-text-secondary">
                    Selecione um orçamento para ver detalhes
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function QuoteDetail({
  quote,
  onDelete,
  onRefresh,
}: {
  quote: Quote;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const cfg = STATUS_CONFIG[quote.status];
  const Icon = cfg.icon;
  const version = quote.versions[quote.currentVersion - 1]!;
  const partsTotal = version.items.reduce((acc, i) => acc + i.total, 0);
  const sub = partsTotal + version.laborCost + version.equipmentCost;
  const disc = sub * (version.discount / 100);
  const tot = sub - disc;

  function getClientLink(): string {
    return `${window.location.origin}/cliente/${quote.token}`;
  }

  return (
    <div className="rounded-xl border border-border bg-dark-900 p-4 animate-[fade-in_200ms]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cfg.bg}`}>
            <Icon className={`h-4 w-4 ${cfg.color}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{quote.client.name}</p>
            <p className="text-[10px] text-text-muted">{quote.id}</p>
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.color} ${cfg.bg} border border-current/20`}>
          {cfg.label.toUpperCase()}
        </span>
      </div>

      {/* Client & vehicle */}
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-dark-800 p-2">
          <span className="text-text-muted">Veículo</span>
          <p className="text-text-primary">{quote.client.vehicle} {quote.client.year}</p>
        </div>
        <div className="rounded-lg bg-dark-800 p-2">
          <span className="text-text-muted">Placa</span>
          <p className="text-text-primary">{quote.client.plate || "—"}</p>
        </div>
        <div className="rounded-lg bg-dark-800 p-2">
          <span className="text-text-muted">Telefone</span>
          <p className="text-text-primary">{quote.client.phone || "—"}</p>
        </div>
        <div className="rounded-lg bg-dark-800 p-2">
          <span className="text-text-muted">Validade</span>
          <p className={isExpired(quote.validUntil) ? "text-danger" : "text-neon-green"}>
            {formatDateBR(quote.validUntil)}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="mb-3">
        <p className="mb-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Itens</p>
        {version.items.map((item, i) => (
          <div key={i} className="flex justify-between py-1 text-xs border-b border-dark-700 last:border-0">
            <span className="text-text-secondary">{item.name} x{item.quantity}</span>
            <span className="tabular text-text-primary">R$ {item.total.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="mb-3 flex flex-col gap-1 border-t border-border pt-2">
        <div className="flex justify-between text-xs">
          <span className="text-text-muted">Peças</span>
          <span className="tabular text-text-primary">R$ {partsTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-text-muted">Mão de obra</span>
          <span className="tabular text-text-primary">R$ {version.laborCost.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm font-bold border-t border-border pt-1">
          <span className="text-text-primary">Total</span>
          <span className="tabular text-neon-cyan">R$ {tot.toFixed(2)}</span>
        </div>
      </div>

      {/* Acceptance info */}
      {quote.acceptance && (
        <div className="mb-3 rounded-lg border border-neon-green/20 bg-neon-green/5 p-2">
          <p className="text-[10px] font-semibold text-neon-green">Aceite Registrado</p>
          <p className="text-[10px] text-text-muted">
            {quote.acceptance.clientName} — {formatDateTimeBR(quote.acceptance.timestamp)} — v{quote.acceptance.version}
          </p>
        </div>
      )}

      {/* Client link */}
      <div className="mb-3">
        <p className="mb-1 text-[10px] text-text-muted">Link do cliente:</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={getClientLink()}
            className="flex-1 rounded-md bg-dark-800 px-2 py-1.5 text-[10px] text-text-secondary border border-border"
          />
          <button
            onClick={() => navigator.clipboard.writeText(getClientLink())}
            className="rounded-md bg-neon-cyan/10 border border-neon-cyan/30 px-2 py-1 text-[10px] text-neon-cyan"
          >
            Copiar
          </button>
        </div>
      </div>

      {/* Audit log */}
      {quote.audit.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <History className="h-3 w-3 text-text-muted" />
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              Histórico de Auditoria
            </p>
          </div>
          <div className="max-h-32 overflow-y-auto flex flex-col gap-1.5">
            {quote.audit.map((entry, i) => (
              <div key={i} className="rounded bg-dark-800 px-2 py-1.5">
                <p className="text-[10px] text-text-primary">{entry.action}</p>
                <p className="text-[9px] text-text-muted">
                  {formatDateTimeBR(entry.timestamp)} — {entry.actor}
                </p>
                {entry.details && (
                  <p className="text-[9px] text-text-muted">{entry.details}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete */}
      <button
        onClick={() => onDelete(quote.id)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-danger hover:bg-danger/10 transition-all"
      >
        <Trash2 className="h-3 w-3" />
        Excluir Orçamento
      </button>
    </div>
  );
}
