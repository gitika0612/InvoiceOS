import {
  Download,
  Eye,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ParsedInvoice } from "./InvoicePreviewCard";

interface InvoicePanelCardProps {
  messageId: string;
  invoice: ParsedInvoice;
  isConfirmed: boolean;
  invoiceNumber?: string;
  isExpanded: boolean;
  onToggle: () => void;
  onConfirm: () => void;
  onDiscard: () => void;
  onDownload: () => void;
  onView: () => void;
}

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function InvoicePanelCard({
  invoice,
  isConfirmed,
  invoiceNumber,
  isExpanded,
  onToggle,
  onConfirm,
  onDiscard,
  onDownload,
  onView,
}: InvoicePanelCardProps) {
  return (
    <div
      className={`
      rounded-2xl border transition-all
      ${
        isConfirmed
          ? "border-emerald-100 bg-emerald-50/50"
          : "border-gray-100 bg-white"
      }
    `}
    >
      {/* Card header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {/* Avatar */}
        <div
          className={`
          w-8 h-8 rounded-full flex items-center justify-center
          text-xs font-bold flex-shrink-0
          ${
            isConfirmed
              ? "bg-emerald-100 text-emerald-700"
              : "bg-indigo-100 text-indigo-700"
          }
        `}
        >
          {invoice.clientName.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {invoice.clientName}
          </p>
          <p className="text-xs text-gray-400">
            {isConfirmed && invoiceNumber
              ? invoiceNumber
              : `${invoice.lineItems?.length || 0} item${
                  (invoice.lineItems?.length || 0) !== 1 ? "s" : ""
                }`}{" "}
            · {formatINR(invoice.total)}
          </p>
        </div>

        {/* Expand toggle */}
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Line items */}
          <div className="space-y-1.5">
            {invoice.lineItems?.map((item, index) => (
              <div
                key={index}
                className="flex justify-between text-xs bg-white rounded-xl px-3 py-2 border border-gray-100"
              >
                <span className="text-gray-600 truncate flex-1">
                  {item.description}
                </span>
                <span className="font-semibold text-gray-900 ml-2">
                  {formatINR(item.amount)}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Subtotal</span>
              <span className="text-gray-700">
                {formatINR(invoice.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">GST ({invoice.gstPercent}%)</span>
              <span className="text-gray-700">
                {formatINR(invoice.gstAmount)}
              </span>
            </div>
            <div className="flex justify-between text-xs font-bold border-t border-gray-100 pt-1.5 mt-1">
              <span className="text-gray-900">Total</span>
              <span className="text-indigo-600">
                {formatINR(invoice.total)}
              </span>
            </div>
          </div>

          {/* GST + Payment Terms */}
          <div className="flex gap-2">
            <div className="flex-1 bg-white rounded-xl border border-gray-100 px-3 py-2 text-center">
              <p className="text-xs text-gray-400">GST</p>
              <p className="text-xs font-semibold text-gray-900">
                {invoice.gstPercent}%
              </p>
            </div>
            <div className="flex-1 bg-white rounded-xl border border-gray-100 px-3 py-2 text-center">
              <p className="text-xs text-gray-400">Terms</p>
              <p className="text-xs font-semibold text-gray-900">
                {invoice.paymentTermsDays} days
              </p>
            </div>
          </div>

          {/* Actions */}
          {isConfirmed ? (
            <div className="flex gap-2">
              <button
                onClick={onView}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                View
              </button>
              <button
                onClick={onDownload}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onConfirm}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:-translate-y-0.5"
                style={{
                  background: "#4F46E5",
                  boxShadow: "0 4px 8px rgba(79,70,229,0.3)",
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirm
              </button>
              <button
                onClick={onDiscard}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Confirmed badge */}
          {isConfirmed && invoiceNumber && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <p className="text-xs font-semibold text-emerald-700">
                Saved as {invoiceNumber}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
