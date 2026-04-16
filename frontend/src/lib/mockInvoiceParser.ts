import api from "@/lib/api";
import { ParsedInvoice } from "@/components/invoice/InvoicePreviewCard";

export interface ParseResult {
  isMultiple: boolean;
  invoice?: ParsedInvoice;
  invoices?: ParsedInvoice[];
}

export async function parseInvoiceWithAI(prompt: string): Promise<ParseResult> {
  const response = await api.post("/invoices/parse", { prompt });
  return {
    isMultiple: response.data.isMultiple,
    invoice: response.data.invoice,
    invoices: response.data.invoices,
  };
}

export async function saveInvoice(
  invoice: ParsedInvoice,
  userId: string,
  originalPrompt: string
): Promise<{ invoiceNumber: string; isDuplicate: boolean }> {
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
    invoiceDate: invoice.invoiceDate, // ← new
    invoiceMonth: invoice.invoiceMonth, // ← new
  });
  return {
    invoiceNumber: response.data.invoice.invoiceNumber,
    isDuplicate: response.data.isDuplicate || false,
  };
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
