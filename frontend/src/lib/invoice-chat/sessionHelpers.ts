import { SessionInvoice } from "@/components/invoice/InvoicePanel";

export function buildSessionContext(sessionInvoices: SessionInvoice[]): string {
  if (sessionInvoices.length === 0) {
    return "No existing invoices in this session.";
  }

  const lines = sessionInvoices.map((si) => {
    const inv = si.invoice;
    const num = si.invoiceNumber || "Draft";

    const items =
      inv.lineItems
        ?.map(
          (l, index) =>
            `${index + 1}. ${l.description} | Qty: ${
              l.quantity
            } | Rate: ₹${l.rate.toLocaleString(
              "en-IN"
            )} | Amount: ₹${l.amount.toLocaleString("en-IN")}`
        )
        .join("\n") || "No items";

    return `
        Invoice Ref: ${num}
        Client: ${inv.clientName}
        Invoice Month: ${inv.invoiceMonth || "Unknown"}
        Invoice Date: ${inv.invoiceDate || "Unknown"}
        GST: ${inv.gstPercent}% ${inv.gstType || "CGST_SGST"}
        Discount: ${inv.discountType || "none"} ${inv.discountValue || 0}
        Payment Terms: ${inv.paymentTermsDays} days
        Notes: ${inv.notes || ""}
        Subtotal: ₹${inv.subtotal.toLocaleString("en-IN")}
        Total: ₹${inv.total.toLocaleString("en-IN")}
        Line Items:
        ${items}
        ---`;
  });

  return `Existing invoices in this session:\n\n${lines.join("\n\n")}`;
}

export function findMatchingInvoices(
  sessionInvoices: SessionInvoice[],
  ref: string
): SessionInvoice[] {
  if (!ref) return [];

  const refLower = ref.toLowerCase().trim();

  const byNumber = sessionInvoices.filter(
    (si) => si.invoiceNumber?.toLowerCase() === refLower
  );

  if (byNumber.length > 0) return byNumber;

  const byExactName = sessionInvoices.filter(
    (si) => si.invoice.clientName.toLowerCase() === refLower
  );
  if (byExactName.length > 0) return byExactName;

  return sessionInvoices.filter(
    (si) =>
      si.invoice.clientName.toLowerCase().includes(refLower) ||
      refLower.includes(si.invoice.clientName.toLowerCase())
  );
}

export // ── Extract possible client name from prompt for memory fetch ──
function extractClientNameFromPrompt(prompt: string): string | null {
  const commonWords = new Set([
    "invoice",
    "bill",
    "create",
    "make",
    "generate",
    "for",
    "to",
    "with",
    "and",
    "or",
    "gst",
    "monthly",
    "the",
    "a",
    "an",
    "in",
    "on",
    "at",
    "from",
    "by",
    "per",
    "hour",
    "day",
    "item",
    "service",
    "payment",
    "terms",
    "days",
    "net",
    "add",
    "change",
    "update",
    "edit",
    "copy",
    "same",
    "duplicate",
    "like",
    "last",
    "previous",
    "next",
  ]);
  const words = prompt.split(/\s+/);
  const candidate = words.find(
    (w) => w.length > 2 && /^[A-Z]/.test(w) && !commonWords.has(w.toLowerCase())
  );
  return candidate || null;
}
