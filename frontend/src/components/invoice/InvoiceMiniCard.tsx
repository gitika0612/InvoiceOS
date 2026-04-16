import { FileText, ChevronRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface InvoiceMiniCardProps {
  clientName: string;
  total: number;
  isConfirmed: boolean;
  invoiceNumber?: string;
  onClick: () => void;
}

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function InvoiceMiniCard({
  clientName,
  total,
  isConfirmed,
  invoiceNumber,
  onClick,
}: InvoiceMiniCardProps) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={`
        mt-3 flex items-center gap-3 px-4 py-3 rounded-2xl h-auto
        transition-all hover:-translate-y-0.5 text-left w-full max-w-sm group
        justify-start
        ${
          isConfirmed
            ? "border-emerald-200 hover:border-emerald-300 hover:shadow-md"
            : "border-gray-200 hover:border-indigo-300 hover:shadow-md"
        }
      `}
    >
      {/* Icon */}
      <div
        className={`
        w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
        ${isConfirmed ? "bg-emerald-100" : "bg-indigo-50"}
      `}
      >
        {isConfirmed ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : (
          <FileText className="w-4 h-4 text-gray-500" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={`text-sm font-semibold truncate ${
              isConfirmed ? "text-emerald-900" : "text-gray-900"
            }`}
          >
            {clientName}
          </p>
          {isConfirmed && invoiceNumber ? (
            <Badge className="text-xs font-medium text-emerald-600 bg-emerald-50 border-emerald-100 px-2 py-0 rounded-full flex-shrink-0">
              {invoiceNumber}
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="text-xs font-medium px-2 py-0 rounded-full flex-shrink-0"
            >
              Draft
            </Badge>
          )}
        </div>
        <p
          className={`text-xs mt-0.5 ${
            isConfirmed ? "text-emerald-600" : "text-gray-400"
          }`}
        >
          {formatINR(total)} ·{" "}
          {isConfirmed ? "View in panel →" : "Pending confirmation"}
        </p>
      </div>

      {/* Arrow */}
      <ChevronRight
        className={`w-4 h-4 flex-shrink-0 transition-colors ${
          isConfirmed
            ? "text-emerald-300 group-hover:text-emerald-500"
            : "text-gray-300 group-hover:text-indigo-400"
        }`}
      />
    </Button>
  );
}
