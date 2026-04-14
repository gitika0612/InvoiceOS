import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download, Loader2 } from "lucide-react";
import { ParsedInvoice } from "../InvoicePreviewCard";
import { InvoicePDF } from "./InvoicePDF";

interface DownloadPDFButtonProps {
  invoice: ParsedInvoice;
  invoiceNumber: string;
  userName?: string;
}

export function DownloadPDFButton({
  invoice,
  invoiceNumber,
  userName,
}: DownloadPDFButtonProps) {
  return (
    <PDFDownloadLink
      document={
        <InvoicePDF
          invoice={invoice}
          invoiceNumber={invoiceNumber}
          userName={userName}
        />
      }
      fileName={`${invoiceNumber}.pdf`}
      className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-2 no-underline"
      style={{ textDecoration: "none" }}
    >
      {({ loading, error }) => {
        if (error) console.error("PDF error:", error);
        return loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Preparing...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>PDF</span>
          </>
        );
      }}
    </PDFDownloadLink>
  );
}
