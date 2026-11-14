import jsPDF from "jspdf";
import { LEGAL } from "./legal-texts";
import type { PaymentTerms } from "./types";

interface QuoteItem {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: string;
}

interface ClientInfo {
  name: string;
  phone: string;
  vehicle: string;
  plate: string;
  year: string;
}

interface QuoteData {
  client: ClientInfo;
  items: QuoteItem[];
  laborCost: number;
  equipmentCost: number;
  discount: number;
  discountAmount: number;
  subtotal: number;
  total: number;
  notes: string;
  paymentTerms: PaymentTerms;
  startDate: string;
  endDate: string;
  validUntil: string;
  quoteId: string;
}

function fmt(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(): string {
  return new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function addHeader(doc: jsPDF, title: string, quoteId: string) {
  doc.setFillColor(12, 12, 12);
  doc.rect(0, 0, 210, 44, "F");

  doc.setFillColor(0, 240, 255);
  doc.rect(0, 44, 210, 1.2, "F");

  doc.setTextColor(240, 240, 240);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("COMPLIANCE 360", 15, 16);

  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text(LEGAL.officeName, 15, 23);
  doc.text(LEGAL.officeAddress, 15, 29);
  doc.text(`CNPJ: ${LEGAL.officeCNPJ} | Tel: ${LEGAL.officePhone}`, 15, 35);

  doc.setFontSize(14);
  doc.setTextColor(0, 240, 255);
  doc.text(title, 15, 42);

  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text(`Nº ${quoteId}`, 195, 16, { align: "right" });
  doc.text(fmtDateTime(), 195, 23, { align: "right" });
}

function addClientBlock(doc: jsPDF, client: ClientInfo, y: number): number {
  doc.setFillColor(22, 22, 22);
  doc.roundedRect(15, y, 180, 30, 2, 2, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 240, 255);
  doc.text("DADOS DO CLIENTE", 20, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const r1 = y + 15;
  const r2 = y + 22;

  doc.setTextColor(120, 120, 120);
  doc.text("Nome:", 20, r1);
  doc.text("Telefone:", 120, r1);
  doc.text("Veículo:", 20, r2);
  doc.text("Placa:", 120, r2);
  doc.text("Ano:", 155, r2);

  doc.setTextColor(220, 220, 220);
  doc.text(client.name || "—", 38, r1);
  doc.text(client.phone || "—", 142, r1);
  doc.text(client.vehicle || "—", 42, r2);
  doc.text(client.plate || "—", 135, r2);
  doc.text(client.year || "—", 167, r2);

  return y + 34;
}

function addItemsTable(doc: jsPDF, items: QuoteItem[], y: number): number {
  doc.setFillColor(28, 28, 28);
  doc.rect(15, y, 180, 9, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 240, 255);

  doc.text("DESCRIÇÃO", 18, y + 6);
  doc.text("QTD", 115, y + 6);
  doc.text("UNIT.", 135, y + 6);
  doc.text("TOTAL", 170, y + 6);

  y += 11;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (i % 2 === 0) {
      doc.setFillColor(18, 18, 18);
      doc.rect(15, y - 3, 180, 10, "F");
    }

    doc.setTextColor(210, 210, 210);
    doc.text(item.name, 18, y + 3);
    doc.setTextColor(150, 150, 150);
    doc.text(String(item.quantity), 118, y + 3);
    doc.text(fmt(item.unitPrice), 135, y + 3);
    doc.setTextColor(210, 210, 210);
    doc.text(fmt(item.total), 170, y + 3);

    y += 10;
  }

  doc.setDrawColor(40, 40, 40);
  doc.line(15, y, 195, y);
  return y + 3;
}

function addTotals(doc: jsPDF, data: QuoteData, y: number): number {
  const rX = 195;
  const lX = 128;
  doc.setFontSize(8);

  const rows: [string, string, string][] = [
    ["Peças / Materiais", fmt(data.items.reduce((a, i) => a + i.total, 0)), ""],
    ["Mão de Obra", fmt(data.laborCost), ""],
  ];
  if (data.equipmentCost > 0) rows.push(["Equipamentos", fmt(data.equipmentCost), ""]);
  if (data.discount > 0) rows.push([`Desconto (${data.discount}%)`, `- ${fmt(data.discountAmount)}`, "danger"]);

  for (const [label, value, color] of rows) {
    doc.setTextColor(140, 140, 140);
    doc.text(label, lX, y);
    doc.setTextColor(color === "danger" ? 239 : 210, color === "danger" ? 68 : 210, color === "danger" ? 68 : 210);
    doc.text(value, rX, y, { align: "right" });
    y += 7;
  }

  doc.setDrawColor(0, 240, 255);
  doc.setLineWidth(0.4);
  doc.line(128, y, 195, y);
  y += 7;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 240, 255);
  doc.text("TOTAL:", lX, y);
  doc.text(fmt(data.total), rX, y, { align: "right" });

  return y + 8;
}

function addConditions(doc: jsPDF, data: QuoteData, y: number): number {
  doc.setFillColor(22, 22, 22);
  doc.roundedRect(15, y, 180, 32, 2, 2, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 240, 255);
  doc.text("CONDIÇÕES (CDC Art. 40)", 20, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(180, 180, 180);

  const col1 = 20;
  const col2 = 110;
  let cy = y + 14;

  doc.text(`Forma de Pagamento: ${data.paymentTerms.method}`, col1, cy);
  doc.text(`Parcelas: ${data.paymentTerms.installments}x`, col2, cy);
  cy += 6;
  doc.text(`Início Previsto: ${fmtDate(data.startDate)}`, col1, cy);
  doc.text(`Término Previsto: ${fmtDate(data.endDate)}`, col2, cy);
  cy += 6;
  doc.text(`Validade do Orçamento: ${fmtDate(data.validUntil)} (${LEGAL.quoteValidityDays} dias — CDC Art. 40, §1º)`, col1, cy);

  return y + 36;
}

function addLegalFooter(doc: jsPDF, data: QuoteData, y: number): number {
  if (data.notes) {
    doc.setFillColor(22, 22, 22);
    doc.roundedRect(15, y, 180, 18, 2, 2, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 240, 255);
    doc.text("OBSERVAÇÕES", 20, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 160, 160);
    const lines = doc.splitTextToSize(data.notes, 168);
    doc.text(lines.slice(0, 2), 20, y + 12);
    y += 22;
  }

  // CDC legal notice
  doc.setFillColor(18, 18, 24);
  doc.roundedRect(15, y, 180, 34, 2, 2, "F");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 200, 220);
  doc.text("FUNDAMENTAÇÃO LEGAL", 20, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(130, 130, 130);
  let ly = y + 11;
  for (const line of LEGAL.cdcFooter) {
    const wrapped = doc.splitTextToSize(line, 168);
    doc.text(wrapped, 20, ly);
    ly += wrapped.length * 3.5;
  }

  y += 38;

  // LGPD notice
  doc.setFontSize(6);
  doc.setTextColor(100, 100, 120);
  const lgpd = doc.splitTextToSize(`LGPD: ${LEGAL.lgpdNotice}`, 168);
  doc.text(lgpd.slice(0, 3), 20, y);

  return y + 14;
}

function addSignatures(doc: jsPDF, y: number) {
  if (y > 250) return;
  doc.setDrawColor(50, 50, 50);
  doc.line(30, y, 90, y);
  doc.line(120, y, 180, y);

  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);
  doc.text("Responsável Técnico", 60, y + 4, { align: "center" });
  doc.text("Cliente", 150, y + 4, { align: "center" });
}

function addPageFooter(doc: jsPDF) {
  const h = doc.internal.pageSize.getHeight();
  doc.setFillColor(12, 12, 12);
  doc.rect(0, h - 16, 210, 16, "F");
  doc.setFillColor(0, 240, 255);
  doc.rect(0, h - 16, 210, 0.4, "F");

  doc.setFontSize(6);
  doc.setTextColor(90, 90, 90);
  doc.text(`${LEGAL.officeName} — ${LEGAL.systemName} — Documento gerado eletronicamente`, 105, h - 9, { align: "center" });
  doc.text("Em conformidade com CDC (Lei 8.078/1990) e LGPD (Lei 13.709/2018)", 105, h - 5, { align: "center" });
}

export function generateQuotePDF(data: QuoteData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, 210, 297, "F");

  addHeader(doc, "ORÇAMENTO PRÉVIO", data.quoteId);

  let y = 52;
  y = addClientBlock(doc, data.client, y);
  y += 3;
  y = addItemsTable(doc, data.items, y);
  y += 3;
  y = addTotals(doc, data, y);
  y += 4;
  y = addConditions(doc, data, y);
  y += 3;
  y = addLegalFooter(doc, data, y);
  y += 6;
  addSignatures(doc, y);
  addPageFooter(doc);

  doc.save(`orcamento-${data.quoteId}.pdf`);
}

export function generateServiceOrderPDF(data: QuoteData & { osNumber?: string }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, 210, 297, "F");

  const osId = data.osNumber || `OS-${data.quoteId}`;
  addHeader(doc, "ORDEM DE SERVIÇO", osId);

  let y = 52;

  // Ref to quote
  doc.setFillColor(22, 22, 22);
  doc.roundedRect(15, y, 180, 10, 2, 2, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 200, 220);
  doc.text(`Orçamento de referência: ${data.quoteId} — Aprovado pelo cliente`, 20, y + 6.5);
  y += 14;

  y = addClientBlock(doc, data.client, y);
  y += 3;

  // Status checkboxes
  doc.setFillColor(22, 22, 22);
  doc.roundedRect(15, y, 180, 18, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 240, 255);
  doc.text("STATUS DO SERVIÇO", 20, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  let sx = 20;
  for (const s of ["Aguardando", "Em Andamento", "Concluído"]) {
    doc.setDrawColor(60, 60, 60);
    doc.circle(sx + 2, y + 13, 1.8);
    doc.text(s, sx + 6, y + 14);
    sx += 55;
  }
  y += 22;

  y = addItemsTable(doc, data.items, y);
  y += 3;
  y = addTotals(doc, data, y);
  y += 4;
  y = addConditions(doc, data, y);
  y += 3;

  // Verification checklist
  doc.setFillColor(22, 22, 22);
  doc.roundedRect(15, y, 180, 18, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 240, 255);
  doc.text("VERIFICAÇÕES TÉCNICAS", 20, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  const checks = ["Teste de pressão", "Teste de vazamento", "Temperatura na saída", "Sistema carregado"];
  let cx = 20;
  let cy = y + 13;
  for (let i = 0; i < checks.length; i++) {
    doc.setDrawColor(50, 50, 50);
    doc.rect(cx, cy - 2.5, 3, 3);
    doc.text(checks[i]!, cx + 5, cy);
    cx += 43;
    if (i === 1) { cx = 20; cy += 6; }
  }
  y += 24;

  y = addLegalFooter(doc, data, y);
  y += 6;
  addSignatures(doc, y);
  addPageFooter(doc);

  doc.save(`ordem-servico-${osId}.pdf`);
}
