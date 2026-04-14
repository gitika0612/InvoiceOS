import api from "@/lib/api";
import { ParsedInvoice } from "@/components/invoice/InvoicePreviewCard";

// Parse invoice using real LangChain AI
export async function parseInvoiceWithAI(
  prompt: string
): Promise<ParsedInvoice> {
  const response = await api.post("/invoices/parse", { prompt });
  return response.data.invoice;
}

// Save confirmed invoice to MongoDB
export async function saveInvoice(
  invoice: ParsedInvoice,
  userId: string,
  originalPrompt: string
): Promise<{ invoiceNumber: string; isDuplicate: boolean }> {
  const response = await api.post("/invoices/save", {
    userId,
    clientName: invoice.clientName,
    lineItems: invoice.lineItems, // ← make sure this is here
    paymentTermsDays: invoice.paymentTermsDays,
    gstPercent: invoice.gstPercent,
    subtotal: invoice.subtotal,
    gstAmount: invoice.gstAmount,
    total: invoice.total,
    originalPrompt,
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
