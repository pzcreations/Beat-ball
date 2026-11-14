export interface ClientInfo {
  name: string;
  phone: string;
  vehicle: string;
  plate: string;
  year: string;
}

export interface QuoteItem {
  partId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: "peca" | "equipamento";
}

export type QuoteStatus = "rascunho" | "enviado" | "aprovado" | "recusado" | "vencido";
export type OSStatus = "aguardando_aprovacao" | "aprovada" | "em_andamento" | "concluida";

export interface PaymentTerms {
  method: string;
  installments: number;
  notes: string;
}

export interface QuoteVersion {
  version: number;
  items: QuoteItem[];
  laborCost: number;
  equipmentCost: number;
  discount: number;
  paymentTerms: PaymentTerms;
  startDate: string;
  endDate: string;
  notes: string;
  createdAt: string;
  changeDescription?: string;
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  details: string;
  actor: "mecanico" | "cliente";
}

export interface Acceptance {
  accepted: boolean;
  timestamp: string;
  clientName: string;
  version: number;
  ipHint?: string;
}

export interface Quote {
  id: string;
  token: string;
  client: ClientInfo;
  versions: QuoteVersion[];
  currentVersion: number;
  status: QuoteStatus;
  acceptance: Acceptance | null;
  audit: AuditEntry[];
  createdAt: string;
  validUntil: string;
  osStatus: OSStatus;
}

export function generateId(): string {
  return `ORC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function generateToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function calculateValidity(fromDate?: string): string {
  const d = fromDate ? new Date(fromDate) : new Date();
  d.setDate(d.getDate() + 10);
  return d.toISOString();
}

export function isExpired(validUntil: string): boolean {
  return new Date() > new Date(validUntil);
}

export function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTimeBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
