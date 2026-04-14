import { pdf } from "@react-pdf/renderer";
import { createElement } from "react";
import { InvoicePDF } from "@/components/invoice/pdf/InvoicePDF";
import { ParsedInvoice } from "@/components/invoice/InvoicePreviewCard";

export async function downloadInvoicePDF(
  invoice: ParsedInvoice,
  invoiceNumber: string,
  userName: string
) {
  const element = createElement(InvoicePDF, {
    invoice,
    invoiceNumber,
    userName,
  });

  // @ts-expect-error — react-pdf types are strict but this works correctly at runtime
  const blob = await pdf(element).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${invoiceNumber}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
