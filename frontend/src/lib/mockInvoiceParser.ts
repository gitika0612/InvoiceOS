import api from "@/lib/api";
import { ParsedInvoice } from "@/components/invoice/InvoicePreviewCard";
import { ClientAPI } from "@/lib/clientApi";

export type MatchType = "exact" | "partial" | "none";

export interface MatchResult {
  type: MatchType;
  client: ClientAPI | null;
  score: number;
}

export interface ParseResult {
  isMultiple: boolean;
  invoice?: ParsedInvoice;
  invoices?: ParsedInvoice[];
  matchResult?: MatchResult;
  invoicesWithMatch?: { invoice: ParsedInvoice; matchResult: MatchResult }[];
}

export interface SavedDraft {
  invoiceNumber: string;
  isDuplicate: boolean;
  _id: string;
}

export async function parseInvoiceWithAI(
  prompt: string,
  userId?: string
): Promise<ParseResult> {
  const response = await api.post("/invoices/parse", { prompt, userId });
  return {
    isMultiple: response.data.isMultiple,
    invoice: response.data.invoice,
    invoices: response.data.invoices,
    matchResult: response.data.matchResult,
    invoicesWithMatch: response.data.invoicesWithMatch,
  };
}

export async function saveDraftInvoice(
  invoice: ParsedInvoice,
  userId: string,
  originalPrompt: string,
  clientId?: string
): Promise<SavedDraft> {
  const response = await api.post("/invoices/save", {
    userId,
    clientName: invoice.clientName,
    lineItems: invoice.lineItems,
    paymentTermsDays: invoice.paymentTermsDays,
    gstPercent: invoice.gstPercent,
    subtotal: invoice.subtotal,
    gstAmount: invoice.gstAmount,
    total: invoice.total,
    originalPrompt,
    invoiceDate: invoice.invoiceDate,
    invoiceMonth: invoice.invoiceMonth,
    clientId: clientId || "",
  });
  return {
    invoiceNumber: response.data.invoice.invoiceNumber,
    isDuplicate: response.data.isDuplicate || false,
    _id: response.data.invoice._id,
  };
}

export async function confirmInvoice(
  invoiceId: string
): Promise<{ invoiceNumber: string }> {
  const response = await api.patch(`/invoices/${invoiceId}/confirm`);
  return {
    invoiceNumber: response.data.invoice.invoiceNumber,
  };
}

export async function saveInvoice(
  invoice: ParsedInvoice,
  userId: string,
  originalPrompt: string,
  clientId?: string
): Promise<SavedDraft> {
  return saveDraftInvoice(invoice, userId, originalPrompt, clientId);
}

export async function updateInvoice(
  invoiceId: string,
  data: Partial<ParsedInvoice> & { status?: string; dueDate?: string }
): Promise<void> {
  await api.put(`/invoices/${invoiceId}`, data);
}

export async function getUserInvoices(userId: string) {
  const response = await api.get("/invoices", {
    headers: { "x-clerk-id": userId },
  });
  return response.data.invoices;
}

export async function fetchDashboardStats(userId: string) {
  const response = await api.get("/invoices/dashboard-stats", {
    headers: { "x-clerk-id": userId },
  });
  return response.data;
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  await api.delete(`/invoices/${invoiceId}`);
}

export async function fetchInvoiceById(id: string) {
  const response = await api.get(`/invoices/${id}`);
  return response.data.invoice;
}
