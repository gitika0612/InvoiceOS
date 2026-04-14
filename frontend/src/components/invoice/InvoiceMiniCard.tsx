import { FileText, ChevronRight, CheckCircle2 } from "lucide-react";

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
    <button
      onClick={onClick}
      className={`
        mt-3 flex items-center gap-3 px-4 py-3 rounded-2xl border
        transition-all hover:-translate-y-0.5 text-left w-full max-w-sm group
        ${
          isConfirmed
            ? "bg-white border-emerald-200 hover:border-emerald-300 hover:shadow-md"
            : "bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md"
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
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ) : (
          <FileText className="w-4 h-4 text-indigo-500" />
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
            <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
              {invoiceNumber}
            </span>
          ) : (
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full flex-shrink-0">
              Draft
            </span>
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
    </button>
  );
}
