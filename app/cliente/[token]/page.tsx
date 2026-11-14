"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  FileText,
  Snowflake,
  AlertTriangle,
} from "lucide-react";
import { LEGAL } from "@/lib/legal-texts";
import { getQuoteByToken, saveQuote, addAuditEntry } from "@/lib/store";
import {
  type Quote,
  formatDateBR,
  formatDateTimeBR,
  isExpired,
} from "@/lib/types";
import { generateQuotePDF } from "@/lib/pdf-generator";

export default function ClientePage() {
  const params = useParams();
  const token = params.token as string;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    const q = getQuoteByToken(token);
    if (q) {
      if (isExpired(q.validUntil) && q.status === "enviado") {
        q.status = "vencido";
        saveQuote(q);
      }
      setQuote(q);
    }
    setLoading(false);
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-950">
        <div className="animate-pulse text-text-muted">Carregando...</div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-950 px-4">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-warning" />
          <h1 className="mt-4 font-display text-2xl text-text-primary">ORÇAMENTO NÃO ENCONTRADO</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Este link pode estar inválido ou o orçamento foi removido.
          </p>
        </div>
      </div>
    );
  }

  const version = quote.versions[quote.currentVersion - 1]!;
  const expired = isExpired(quote.validUntil);
  const alreadyActed = quote.status === "aprovado" || quote.status === "recusado";
  const partsTotal = version.items.reduce((acc, i) => acc + i.total, 0);
  const subtotal = partsTotal + version.laborCost + version.equipmentCost;
  const discountAmount = subtotal * (version.discount / 100);
  const total = subtotal - discountAmount;

  function handleAccept() {
    if (!quote) return;
    setAccepting(true);
    setTimeout(() => {
      quote.status = "aprovado";
      quote.osStatus = "aprovada";
      quote.acceptance = {
        accepted: true,
        timestamp: new Date().toISOString(),
        clientName: quote.client.name,
        version: quote.currentVersion,
      };
      saveQuote(quote);
      addAuditEntry(quote.id, {
        action: "Orçamento aprovado pelo cliente",
        details: `Aceite da versão ${quote.currentVersion} — ${quote.client.name}`,
        actor: "cliente",
      });
      setQuote({ ...quote });
      setAccepted(true);
      setAccepting(false);
    }, 800);
  }

  function handleRefuse() {
    if (!quote) return;
    quote.status = "recusado";
    saveQuote(quote);
    addAuditEntry(quote.id, {
      action: "Orçamento recusado pelo cliente",
      details: `Recusa da versão ${quote.currentVersion} — ${quote.client.name}`,
      actor: "cliente",
    });
    setQuote({ ...quote });
    setRefused(true);
  }

  function handleDownloadPDF() {
    if (!quote) return;
    generateQuotePDF({
      client: quote.client,
      items: version.items,
      laborCost: version.laborCost,
      equipmentCost: version.equipmentCost,
      discount: version.discount,
      discountAmount,
      subtotal,
      total,
      notes: version.notes,
      paymentTerms: version.paymentTerms,
      startDate: version.startDate,
      endDate: version.endDate,
      validUntil: quote.validUntil,
      quoteId: quote.id,
    });
  }

  return (
    <div className="min-h-screen bg-dark-950 px-4 py-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon-cyan/10 border border-neon-cyan/20">
            <Snowflake className="h-5 w-5 text-neon-cyan" />
          </div>
          <div>
            <h1 className="font-display text-xl tracking-wider text-text-primary">COMPLIANCE 360</h1>
            <p className="text-[10px] text-text-muted tracking-widest uppercase">{LEGAL.officeName}</p>
          </div>
        </div>

        {/* Status banner */}
        {expired && !alreadyActed && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3">
            <Clock className="h-5 w-5 text-warning" />
            <div>
              <p className="text-sm font-semibold text-warning">Orçamento Vencido</p>
              <p className="text-xs text-text-muted">
                A validade expirou em {formatDateBR(quote.validUntil)}. Solicite um novo orçamento.
              </p>
            </div>
          </div>
        )}

        {accepted && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-neon-green/30 bg-success-bg px-4 py-3 animate-[slide-up_300ms]">
            <CheckCircle className="h-5 w-5 text-neon-green" />
            <div>
              <p className="text-sm font-semibold text-neon-green">Orçamento Aprovado</p>
              <p className="text-xs text-text-muted">
                Aceite registrado em {formatDateTimeBR(quote.acceptance!.timestamp)}
              </p>
            </div>
          </div>
        )}

        {refused && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 animate-[slide-up_300ms]">
            <XCircle className="h-5 w-5 text-danger" />
            <div>
              <p className="text-sm font-semibold text-danger">Orçamento Recusado</p>
              <p className="text-xs text-text-muted">O serviço não será realizado.</p>
            </div>
          </div>
        )}

        {quote.status === "aprovado" && !accepted && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-neon-green/30 bg-success-bg px-4 py-3">
            <CheckCircle className="h-5 w-5 text-neon-green" />
            <p className="text-sm text-neon-green">
              Este orçamento foi aprovado em {formatDateTimeBR(quote.acceptance!.timestamp)}.
            </p>
          </div>
        )}

        {/* Quote card */}
        <div className="rounded-xl border border-border bg-dark-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-2xl tracking-wider text-neon-cyan">ORÇAMENTO</h2>
              <p className="text-xs text-text-muted">Nº {quote.id} — Versão {quote.currentVersion}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-muted">Emitido em</p>
              <p className="text-sm text-text-primary">{formatDateBR(quote.createdAt)}</p>
              <p className="text-xs text-text-muted mt-1">
                Válido até <span className={expired ? "text-danger" : "text-neon-green"}>
                  {formatDateBR(quote.validUntil)}
                </span>
              </p>
            </div>
          </div>

          {/* Client info */}
          <div className="mb-4 rounded-lg bg-dark-800 p-3">
            <p className="text-xs text-text-muted mb-1">Cliente</p>
            <p className="text-sm font-medium text-text-primary">{quote.client.name}</p>
            <p className="text-xs text-text-secondary">
              {quote.client.vehicle} {quote.client.year} — {quote.client.plate}
            </p>
          </div>

          {/* Items */}
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">Serviços e Peças</p>
            <div className="flex flex-col gap-2">
              {version.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-dark-800 px-3 py-2">
                  <div>
                    <p className="text-sm text-text-primary">{item.name}</p>
                    <p className="text-[11px] text-text-muted">
                      {item.quantity}x R$ {item.unitPrice.toFixed(2)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular text-text-primary">
                    R$ {item.total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="mb-4 flex flex-col gap-1.5 border-t border-border pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Peças / Materiais</span>
              <span className="tabular text-text-primary">R$ {partsTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Mão de Obra</span>
              <span className="tabular text-text-primary">R$ {version.laborCost.toFixed(2)}</span>
            </div>
            {version.equipmentCost > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Equipamentos</span>
                <span className="tabular text-text-primary">R$ {version.equipmentCost.toFixed(2)}</span>
              </div>
            )}
            {version.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Desconto ({version.discount}%)</span>
                <span className="tabular text-danger">- R$ {discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 mt-1">
              <span className="text-lg font-bold text-text-primary">Total</span>
              <span className="text-2xl font-bold tabular text-neon-cyan">R$ {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment & dates */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-dark-800 p-3">
              <p className="text-[10px] text-text-muted uppercase">Pagamento</p>
              <p className="text-sm text-text-primary">
                {version.paymentTerms.method}
                {version.paymentTerms.installments > 1 && ` — ${version.paymentTerms.installments}x`}
              </p>
            </div>
            <div className="rounded-lg bg-dark-800 p-3">
              <p className="text-[10px] text-text-muted uppercase">Previsão</p>
              <p className="text-sm text-text-primary">
                {version.startDate ? formatDateBR(version.startDate + "T12:00:00") : "—"} a{" "}
                {version.endDate ? formatDateBR(version.endDate + "T12:00:00") : "—"}
              </p>
            </div>
          </div>

          {version.notes && (
            <div className="mb-4 rounded-lg bg-dark-800 p-3">
              <p className="text-[10px] text-text-muted uppercase mb-1">Observações</p>
              <p className="text-sm text-text-secondary">{version.notes}</p>
            </div>
          )}

          {/* CDC legal notice */}
          <div className="mb-4 rounded-lg border border-dark-500 bg-dark-800 p-3">
            <p className="text-[10px] font-semibold text-neon-cyan uppercase tracking-wider mb-1">
              Base Legal
            </p>
            {LEGAL.cdcFooter.map((line, i) => (
              <p key={i} className="text-[10px] text-text-muted leading-relaxed">
                {line}
              </p>
            ))}
          </div>

          {/* LGPD notice */}
          <div className="mb-6 rounded-lg border border-neon-purple/20 bg-neon-purple/5 p-3">
            <div className="flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 text-neon-purple flex-shrink-0" />
              <p className="text-[10px] text-text-muted leading-relaxed">{LEGAL.lgpdNotice}</p>
            </div>
          </div>

          {/* Actions */}
          {!alreadyActed && !expired && (
            <div>
              <div className="mb-3 rounded-lg border border-border bg-dark-800 p-3">
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  {LEGAL.acceptanceTerms}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleRefuse}
                  className="flex items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger hover:bg-danger/20 transition-all"
                >
                  <XCircle className="h-4 w-4" />
                  Recusar
                </button>
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="flex items-center justify-center gap-2 rounded-xl bg-neon-green px-4 py-3 text-sm font-bold text-dark-950 hover:bg-green-400 transition-all disabled:opacity-60"
                >
                  {accepting ? (
                    <span className="animate-pulse">Processando...</span>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Aprovar Orçamento
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Download PDF */}
          <button
            onClick={handleDownloadPDF}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-dark-800 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:border-dark-400 transition-all"
          >
            <FileText className="h-4 w-4" />
            Baixar PDF do Orçamento
          </button>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[10px] text-text-muted">
          {LEGAL.officeName} — {LEGAL.systemName} — Documento eletrônico
        </p>
      </div>
    </div>
  );
}
