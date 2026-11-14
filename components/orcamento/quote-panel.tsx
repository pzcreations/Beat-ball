"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Trash2,
  Send,
  ClipboardList,
  Plus,
  Minus,
  DollarSign,
  User,
  Car,
  Phone,
  Calendar,
  CreditCard,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { AC_PARTS, CATEGORY_COLORS, getPartById, type SelectedPart } from "@/lib/ac-parts";
import { LEGAL } from "@/lib/legal-texts";
import { saveQuote, addAuditEntry, getQuoteById } from "@/lib/store";
import {
  generateId,
  generateToken,
  calculateValidity,
  formatDateBR,
  type Quote,
  type QuoteVersion,
  type ClientInfo,
  type PaymentTerms,
} from "@/lib/types";
import { generateQuotePDF } from "@/lib/pdf-generator";

interface QuotePanelProps {
  selectedParts: SelectedPart[];
  onPartQuantity: (partId: string, quantity: number) => void;
  onPartToggle: (partId: string) => void;
  onClearParts: () => void;
}

interface PriceOverride {
  [partId: string]: number;
}

export function QuotePanel({ selectedParts, onPartQuantity, onPartToggle, onClearParts }: QuotePanelProps) {
  const router = useRouter();
  const [laborCost, setLaborCost] = useState(200);
  const [equipmentCost, setEquipmentCost] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    name: "",
    phone: "",
    vehicle: "",
    plate: "",
    year: "",
  });
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>({
    method: "Dinheiro / PIX",
    installments: 1,
    notes: "",
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priceOverrides, setPriceOverrides] = useState<PriceOverride>({});
  const [showClientForm, setShowClientForm] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [lgpdConsent, setLgpdConsent] = useState(false);

  function getPartPrice(partId: string): number {
    if (priceOverrides[partId] !== undefined) return priceOverrides[partId];
    const part = getPartById(partId);
    return part?.defaultPrice ?? 0;
  }

  const partsTotal = selectedParts.reduce((acc, sp) => acc + getPartPrice(sp.id) * sp.quantity, 0);
  const subtotal = partsTotal + laborCost + equipmentCost;
  const discountAmount = subtotal * (discount / 100);
  const total = subtotal - discountAmount;

  function handlePriceChange(partId: string, value: string) {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setPriceOverrides((prev) => ({ ...prev, [partId]: num }));
    }
  }

  function buildQuoteItems() {
    return selectedParts.map((sp) => {
      const part = getPartById(sp.id)!;
      return {
        partId: sp.id,
        name: part.name,
        description: part.description,
        quantity: sp.quantity,
        unitPrice: getPartPrice(sp.id),
        total: getPartPrice(sp.id) * sp.quantity,
        category: "peca" as const,
      };
    });
  }

  function handleSaveAndSend() {
    const now = new Date().toISOString();
    const id = generateId();
    const token = generateToken();
    const validUntil = calculateValidity();

    const version: QuoteVersion = {
      version: 1,
      items: buildQuoteItems(),
      laborCost,
      equipmentCost,
      discount,
      paymentTerms,
      startDate,
      endDate,
      notes,
      createdAt: now,
    };

    const quote: Quote = {
      id,
      token,
      client: clientInfo,
      versions: [version],
      currentVersion: 1,
      status: "enviado",
      acceptance: null,
      audit: [],
      createdAt: now,
      validUntil,
      osStatus: "aguardando_aprovacao",
    };

    saveQuote(quote);
    addAuditEntry(id, {
      action: "Orçamento criado e enviado",
      details: `Versão 1 — ${selectedParts.length} itens — Total: R$ ${total.toFixed(2)} — Validade: ${formatDateBR(validUntil)}`,
      actor: "mecanico",
    });

    setSaved(true);
    setSavedQuoteId(id);
  }

  function handleGeneratePDF() {
    const items = buildQuoteItems();
    const now = new Date().toISOString();
    const validUntil = calculateValidity();

    generateQuotePDF({
      client: clientInfo,
      items,
      laborCost,
      equipmentCost,
      discount,
      discountAmount,
      subtotal,
      total,
      notes,
      paymentTerms,
      startDate,
      endDate,
      validUntil,
      quoteId: savedQuoteId || generateId(),
    });
  }

  function getClientLink(): string {
    if (!savedQuoteId) return "";
    const q = getQuoteById(savedQuoteId);
    if (!q) return "";
    return `${window.location.origin}/cliente/${q.token}`;
  }

  function copyLink() {
    const link = getClientLink();
    if (link) navigator.clipboard.writeText(link);
  }

  const canSend = selectedParts.length > 0 && clientInfo.name.trim() && clientInfo.vehicle.trim() && startDate && endDate;

  if (saved && savedQuoteId) {
    const link = getClientLink();
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-neon-green/30 bg-neon-green/5 p-6 text-center animate-[slide-up_300ms]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neon-green/20">
            <Send className="h-6 w-6 text-neon-green" />
          </div>
          <h3 className="font-display text-2xl tracking-wider text-neon-green">ORÇAMENTO ENVIADO</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Nº {savedQuoteId} — Válido por {LEGAL.quoteValidityDays} dias
          </p>

          <div className="mt-6 rounded-lg border border-border bg-dark-800 p-3">
            <p className="mb-2 text-xs text-text-muted">Link para o cliente aprovar:</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={link}
                className="flex-1 rounded-md bg-dark-700 px-3 py-2 text-xs text-text-primary border border-border"
              />
              <button
                onClick={copyLink}
                className="rounded-md bg-neon-cyan/10 border border-neon-cyan/30 px-3 py-2 text-xs font-semibold text-neon-cyan hover:bg-neon-cyan/20 transition-all"
              >
                Copiar
              </button>
            </div>
            <p className="mt-2 text-[10px] text-text-muted">
              O serviço só pode ser iniciado após o aceite do cliente (CDC, Art. 39, VI)
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={handleGeneratePDF}
              className="flex items-center justify-center gap-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-2.5 text-sm font-semibold text-neon-cyan hover:bg-neon-cyan/20 transition-all"
            >
              <FileText className="h-4 w-4" />
              Baixar PDF
            </button>
            <button
              onClick={() => router.push("/painel")}
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-dark-800 px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:border-dark-400 transition-all"
            >
              Ver Painel
            </button>
          </div>

          <button
            onClick={() => {
              setSaved(false);
              setSavedQuoteId(null);
              onClearParts();
              setClientInfo({ name: "", phone: "", vehicle: "", plate: "", year: "" });
              setNotes("");
              setStartDate("");
              setEndDate("");
              setDiscount(0);
              setLaborCost(200);
              setEquipmentCost(0);
            }}
            className="mt-4 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Novo orçamento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Client info */}
      <div className="rounded-xl border border-border bg-dark-900 p-4">
        <button
          onClick={() => setShowClientForm(!showClientForm)}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-neon-cyan" />
            <h3 className="font-display text-lg tracking-wider text-text-primary">
              DADOS DO CLIENTE
            </h3>
          </div>
          <span className="text-xs text-text-muted">{showClientForm ? "▲" : "▼"}</span>
        </button>

        {showClientForm && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 animate-[slide-up_200ms]">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-text-muted">
                Nome do Cliente <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={clientInfo.name}
                  onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
                  placeholder="Ex: João Silva"
                  className="w-full rounded-lg border border-border bg-dark-800 py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan/40 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Telefone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="tel"
                  value={clientInfo.phone}
                  onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="w-full rounded-lg border border-border bg-dark-800 py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan/40 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">
                Veículo <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <Car className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={clientInfo.vehicle}
                  onChange={(e) => setClientInfo({ ...clientInfo, vehicle: e.target.value })}
                  placeholder="Ex: VW Gol 1.0"
                  className="w-full rounded-lg border border-border bg-dark-800 py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan/40 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Placa</label>
              <input
                type="text"
                value={clientInfo.plate}
                onChange={(e) => setClientInfo({ ...clientInfo, plate: e.target.value.toUpperCase() })}
                placeholder="ABC-1234"
                className="w-full rounded-lg border border-border bg-dark-800 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Ano</label>
              <input
                type="text"
                value={clientInfo.year}
                onChange={(e) => setClientInfo({ ...clientInfo, year: e.target.value })}
                placeholder="2024"
                className="w-full rounded-lg border border-border bg-dark-800 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan/40 focus:outline-none"
              />
            </div>

            {/* LGPD notice */}
            <div className="sm:col-span-2 rounded-lg border border-neon-purple/20 bg-neon-purple/5 p-3">
              <div className="flex items-start gap-2">
                <Shield className="mt-0.5 h-4 w-4 text-neon-purple flex-shrink-0" />
                <div>
                  <p className="text-[11px] text-neon-purple font-semibold mb-1">LGPD — Aviso de Privacidade</p>
                  <p className="text-[10px] text-text-muted leading-relaxed">{LEGAL.lgpdNotice}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selected parts */}
      <div className="rounded-xl border border-border bg-dark-900 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-neon-cyan" />
            <h3 className="font-display text-lg tracking-wider text-text-primary">
              PEÇAS / MATERIAIS
            </h3>
          </div>
          {selectedParts.length > 0 && (
            <button
              onClick={onClearParts}
              className="flex items-center gap-1 text-xs text-danger hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Limpar
            </button>
          )}
        </div>

        {selectedParts.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-dark-700">
              <ClipboardList className="h-5 w-5 text-text-muted" />
            </div>
            <p className="text-sm text-text-secondary">Nenhuma peça selecionada</p>
            <p className="text-xs text-text-muted">
              Clique nos pontos do carro 3D para selecionar
            </p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {selectedParts.map((sp) => {
              const part = getPartById(sp.id);
              if (!part) return null;
              return (
                <div
                  key={sp.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-dark-800 p-3 animate-[slide-up_200ms]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[part.category] }}
                      />
                      <div>
                        <p className="text-sm font-medium text-text-primary">{part.name}</p>
                        <p className="text-[11px] text-text-muted">{part.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onPartToggle(sp.id)}
                      className="ml-2 flex-shrink-0 text-text-muted hover:text-danger transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onPartQuantity(sp.id, Math.max(1, sp.quantity - 1))}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-dark-700 text-text-secondary hover:text-text-primary transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm tabular text-text-primary">{sp.quantity}</span>
                      <button
                        onClick={() => onPartQuantity(sp.id, sp.quantity + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-dark-700 text-text-secondary hover:text-text-primary transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="relative flex-1 max-w-[120px]">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">R$</span>
                      <input
                        type="number"
                        value={getPartPrice(sp.id)}
                        onChange={(e) => handlePriceChange(sp.id, e.target.value)}
                        step="0.01"
                        min="0"
                        className="w-full rounded-md border border-border bg-dark-700 py-1.5 pl-8 pr-2 text-right text-sm tabular text-text-primary focus:border-neon-cyan/40 focus:outline-none"
                      />
                    </div>

                    <span className="min-w-[80px] text-right text-sm font-semibold tabular text-neon-cyan">
                      R$ {(getPartPrice(sp.id) * sp.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Values — CDC Art. 40 compliant */}
      <div className="rounded-xl border border-border bg-dark-900 p-4">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-4 w-4 text-neon-cyan" />
          <h3 className="font-display text-lg tracking-wider text-text-primary">
            VALORES (CDC Art. 40)
          </h3>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-text-muted">
                Mão de Obra (R$) <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                value={laborCost}
                onChange={(e) => setLaborCost(parseFloat(e.target.value) || 0)}
                min="0"
                step="10"
                className="w-full rounded-lg border border-border bg-dark-800 px-3 py-2.5 text-sm tabular text-text-primary focus:border-neon-cyan/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Equipamentos (R$)</label>
              <input
                type="number"
                value={equipmentCost}
                onChange={(e) => setEquipmentCost(parseFloat(e.target.value) || 0)}
                min="0"
                step="10"
                className="w-full rounded-lg border border-border bg-dark-800 px-3 py-2.5 text-sm tabular text-text-primary focus:border-neon-cyan/40 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-muted">Desconto (%)</label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
              min="0"
              max="100"
              className="w-full rounded-lg border border-border bg-dark-800 px-3 py-2.5 text-sm tabular text-text-primary focus:border-neon-cyan/40 focus:outline-none"
            />
          </div>

          {/* Dates — CDC Art. 40 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs text-text-muted">
                <Calendar className="h-3 w-3" />
                Início Previsto <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-dark-800 px-3 py-2.5 text-sm text-text-primary focus:border-neon-cyan/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs text-text-muted">
                <Calendar className="h-3 w-3" />
                Término Previsto <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-dark-800 px-3 py-2.5 text-sm text-text-primary focus:border-neon-cyan/40 focus:outline-none"
              />
            </div>
          </div>

          {/* Payment terms */}
          <div>
            <button
              onClick={() => setShowPayment(!showPayment)}
              className="flex items-center gap-2 text-xs text-neon-cyan hover:text-neon-cyan-dim transition-colors"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Condições de pagamento {showPayment ? "▲" : "▼"}
            </button>
            {showPayment && (
              <div className="mt-2 grid grid-cols-2 gap-3 animate-[slide-up_200ms]">
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Forma</label>
                  <select
                    value={paymentTerms.method}
                    onChange={(e) => setPaymentTerms({ ...paymentTerms, method: e.target.value })}
                    className="w-full rounded-lg border border-border bg-dark-800 px-3 py-2.5 text-sm text-text-primary focus:border-neon-cyan/40 focus:outline-none"
                  >
                    <option>Dinheiro / PIX</option>
                    <option>Cartão de Crédito</option>
                    <option>Cartão de Débito</option>
                    <option>Boleto</option>
                    <option>Transferência</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Parcelas</label>
                  <select
                    value={paymentTerms.installments}
                    onChange={(e) =>
                      setPaymentTerms({ ...paymentTerms, installments: parseInt(e.target.value) })
                    }
                    className="w-full rounded-lg border border-border bg-dark-800 px-3 py-2.5 text-sm text-text-primary focus:border-neon-cyan/40 focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        {n}x {n === 1 ? "(à vista)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-muted">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anotações adicionais..."
              className="w-full rounded-lg border border-border bg-dark-800 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan/40 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Totals */}
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Peças / Materiais ({selectedParts.length})</span>
            <span className="tabular text-text-primary">R$ {partsTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Mão de Obra</span>
            <span className="tabular text-text-primary">R$ {laborCost.toFixed(2)}</span>
          </div>
          {equipmentCost > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Equipamentos</span>
              <span className="tabular text-text-primary">R$ {equipmentCost.toFixed(2)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Desconto ({discount}%)</span>
              <span className="tabular text-danger">- R$ {discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2">
            <span className="text-base font-semibold text-text-primary">Total</span>
            <span className="text-xl font-bold tabular text-neon-cyan">
              R$ {total.toFixed(2)}
            </span>
          </div>
          <p className="text-[10px] text-text-muted">
            Validade: {LEGAL.quoteValidityDays} dias a partir do envio (CDC Art. 40, §1º)
          </p>
        </div>
      </div>

      {/* Validation */}
      {!canSend && selectedParts.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning-bg px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-warning flex-shrink-0" />
          <p className="text-xs text-warning">
            Preencha: nome do cliente, veículo, e datas de início/término para enviar o orçamento (CDC Art. 40).
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleGeneratePDF}
          disabled={selectedParts.length === 0}
          className="flex items-center justify-center gap-2 rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-3 text-sm font-semibold text-neon-cyan transition-all hover:bg-neon-cyan/20 hover:shadow-glow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileText className="h-4 w-4" />
          Gerar PDF
        </button>
        <button
          onClick={handleSaveAndSend}
          disabled={!canSend}
          className="flex items-center justify-center gap-2 rounded-xl bg-neon-cyan px-4 py-3 text-sm font-bold text-dark-950 transition-all hover:bg-neon-cyan-dim disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
          Enviar Orçamento
        </button>
      </div>
    </div>
  );
}
