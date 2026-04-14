import { Invoice } from "../models/Invoice";

// Generates invoice numbers like INV-2024-001, INV-2024-002
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  // Count how many invoices exist this year
  const count = await Invoice.countDocuments({
    invoiceNumber: { $regex: `^${prefix}` },
  });

  // Pad with zeros: 001, 002, 003...
  const number = String(count + 1).padStart(3, "0");
  return `${prefix}${number}`;
}
