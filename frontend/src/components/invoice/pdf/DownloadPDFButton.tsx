import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { Download, Loader2 } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { ParsedInvoice } from "../InvoicePreviewCard";
import { InvoicePDF } from "./InvoicePDF";
import { useAuth } from "@/hooks/useAuth";

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
  const { user } = useUser();
  const { getUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      // Fetch profile to get business + bank details
      const profile = await getUserProfile();

      const blob = await pdf(
        <InvoicePDF
          invoice={invoice}
          invoiceNumber={invoiceNumber}
          userName={userName || user?.fullName || "Ledger User"}
          profile={profile}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoiceNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-2"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Preparing...</span>
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          <span>PDF</span>
        </>
      )}
    </button>
  );
}
