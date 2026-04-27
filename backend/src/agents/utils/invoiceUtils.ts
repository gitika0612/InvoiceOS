import { ParsedInvoice } from "../schemas/invoiceSchema";

/**
 * Recalculates all totals from line items.
 * Handles: normal invoices, discount invoices, GST variants.
 * Only sets schema-valid fields — no cgstPercent/sgstPercent/igstPercent.
 */
export function recalculateTotals(invoice: ParsedInvoice): ParsedInvoice {
  const subtotal = invoice.lineItems.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  const discountType = invoice.discountType || "none";
  const discountValue = invoice.discountValue || 0;

  const discountAmount =
    discountType === "percent"
      ? Math.round((subtotal * discountValue) / 100)
      : discountType === "amount"
      ? Math.min(discountValue, subtotal)
      : 0;

  const taxableAmount = subtotal - discountAmount;
  const gstPercent = invoice.gstPercent ?? 18;
  const gstAmount = Math.round((taxableAmount * gstPercent) / 100);

  const gstType = invoice.gstType || "CGST_SGST";
  const cgstAmount = gstType === "CGST_SGST" ? Math.round(gstAmount / 2) : 0;
  const sgstAmount = gstType === "CGST_SGST" ? gstAmount - cgstAmount : 0;
  const igstAmount = gstType === "IGST" ? gstAmount : 0;

  return {
    ...invoice,
    subtotal,
    discountAmount,
    taxableAmount,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    total: taxableAmount + gstAmount,
  };
}

/**
 * Diff two line item arrays and return human-readable summary + change flag.
 */
export function diffLineItems(
  oldItems: Array<{ description: string; quantity: number; rate: number }>,
  newItems: Array<{ description: string; quantity: number; rate: number }>
): { summary: string; hasRealChange: boolean } {
  const key = (d: string) => d.toLowerCase().trim();
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const newItem of newItems) {
    const oldMatch = oldItems.find(
      (o) => key(o.description) === key(newItem.description)
    );
    if (!oldMatch) {
      added.push(newItem.description);
    } else if (
      oldMatch.quantity !== newItem.quantity ||
      Math.abs(oldMatch.rate - newItem.rate) > 0.01
    ) {
      modified.push(
        `**${newItem.description}** (₹${newItem.rate.toLocaleString(
          "en-IN"
        )} × ${newItem.quantity})`
      );
    }
  }

  for (const oldItem of oldItems) {
    const stillExists = newItems.some(
      (n) => key(n.description) === key(oldItem.description)
    );
    if (!stillExists) removed.push(oldItem.description);
  }

  const parts: string[] = [];
  if (removed.length === 1 && added.length === 1) {
    parts.push(`Replaced **${removed[0]}** with **${added[0]}**`);
  } else {
    if (added.length > 0)
      parts.push(`Added ${added.map((d) => `**${d}**`).join(", ")}`);
    if (removed.length > 0)
      parts.push(`Removed ${removed.map((d) => `**${d}**`).join(", ")}`);
  }
  if (modified.length > 0) parts.push(`Updated ${modified.join(", ")}`);

  return {
    summary: parts.join(" · "),
    hasRealChange:
      added.length > 0 || removed.length > 0 || modified.length > 0,
  };
}

export function formatINR(amount: number): string {
  const abs = Math.abs(amount).toLocaleString("en-IN");
  return amount < 0 ? `−₹${abs}` : `₹${abs}`;
}
