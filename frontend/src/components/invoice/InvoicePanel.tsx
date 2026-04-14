import { useState, useMemo } from "react";
import {
  FileText,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { ParsedInvoice } from "./InvoicePreviewCard";
import { InvoicePreviewCard } from "./InvoicePreviewCard";

export interface SessionInvoice {
  messageId: string;
  invoice: ParsedInvoice;
  isConfirmed: boolean;
  invoiceNumber?: string;
  invoiceId?: string;
  dbMessageId: string;
}

interface InvoicePanelProps {
  sessionInvoices: SessionInvoice[];
  selectedMessageId: string | null;
  onConfirm: (messageId: string) => void;
  onDiscard: (messageId: string) => void;
  onEdit: (messageId: string, updated: ParsedInvoice) => void;
  onSelect: (messageId: string) => void;
  userName?: string;
}

type PanelTab = "drafts" | "saved";

export function InvoicePanel({
  sessionInvoices,
  selectedMessageId,
  onConfirm,
  onDiscard,
  onEdit,
  onSelect,
  userName,
}: InvoicePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [manualTab, setManualTab] = useState<PanelTab | null>(null);
  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(null);

  // newest first
  const drafts = [...sessionInvoices.filter((s) => !s.isConfirmed)].reverse();
  const saved = [...sessionInvoices.filter((s) => s.isConfirmed)].reverse();

  // Selected invoice — find in ALL invoices
  const selectedInvoice = useMemo(() => {
    return (
      sessionInvoices.find((s) => s.messageId === selectedMessageId) || null
    );
  }, [sessionInvoices, selectedMessageId]);

  // Reset manual tab when selection changes → tab auto-follows selected invoice
  if (selectedMessageId !== prevSelectedId) {
    setPrevSelectedId(selectedMessageId);
    setManualTab(null);
  }

  // Derive active tab
  // manualTab wins if user clicked a tab
  // otherwise follow the selected invoice
  const activeTab: PanelTab =
    manualTab ?? (selectedInvoice?.isConfirmed ? "saved" : "drafts");

  const visibleInvoices = activeTab === "drafts" ? drafts : saved;

  if (sessionInvoices.length === 0) return null;

  return (
    <div
      className={`
      relative flex flex-col bg-[#F9FAFB] border-l border-gray-100
      transition-all duration-300 flex-shrink-0 h-full
      ${collapsed ? "w-10" : "w-[420px]"}
    `}
    >
      {/* ── Collapse toggle ── */}
      <div className="absolute top-0 right-0 z-10">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-8 h-8 mt-3 mr-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          {collapsed ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* ── Header ── */}
          <div className="px-4 pt-3 pb-3 border-b border-gray-100 bg-white">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide pr-8">
              Session Invoices
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {sessionInvoices.length} invoice
              {sessionInvoices.length !== 1 ? "s" : ""} this chat
            </p>
          </div>

          {/* ── Tabs ── */}
          <div className="flex border-b border-gray-100 bg-white">
            <button
              onClick={() => {
                setManualTab("drafts");
                // Auto select first draft
                if (drafts.length > 0) onSelect(drafts[0].messageId);
              }}
              className={`
                flex-1 flex items-center justify-center gap-1.5 py-2.5
                text-xs font-semibold transition-colors border-b-2
                ${
                  activeTab === "drafts"
                    ? "text-indigo-600 border-indigo-600"
                    : "text-gray-400 border-transparent hover:text-gray-600"
                }
              `}
            >
              <FileText className="w-3.5 h-3.5" />
              Drafts
              {drafts.length > 0 && (
                <span
                  className={`
                  text-xs px-1.5 py-0.5 rounded-full font-bold
                  ${
                    activeTab === "drafts"
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-gray-100 text-gray-500"
                  }
                `}
                >
                  {drafts.length}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setManualTab("saved");
                // Auto select first saved
                if (saved.length > 0) onSelect(saved[0].messageId);
              }}
              className={`
                flex-1 flex items-center justify-center gap-1.5 py-2.5
                text-xs font-semibold transition-colors border-b-2
                ${
                  activeTab === "saved"
                    ? "text-indigo-600 border-indigo-600"
                    : "text-gray-400 border-transparent hover:text-gray-600"
                }
              `}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saved
              {saved.length > 0 && (
                <span
                  className={`
                  text-xs px-1.5 py-0.5 rounded-full font-bold
                  ${
                    activeTab === "saved"
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-gray-100 text-gray-500"
                  }
                `}
                >
                  {saved.length}
                </span>
              )}
            </button>
          </div>

          {/* ── Pills — when multiple ── */}
          {visibleInvoices.length > 1 && (
            <div className="flex gap-2 px-4 py-2.5 overflow-x-auto bg-white border-b border-gray-100">
              {visibleInvoices.map((si) => (
                <button
                  key={si.messageId}
                  onClick={() => onSelect(si.messageId)}
                  className={`
                    flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold
                    transition-all whitespace-nowrap
                    ${
                      selectedMessageId === si.messageId
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }
                  `}
                >
                  {si.invoice.clientName}
                  {si.invoiceNumber && ` · ${si.invoiceNumber}`}
                </button>
              ))}
            </div>
          )}

          {/* ── Invoice Preview Card ── */}
          <div className="flex-1 overflow-y-auto p-4">
            {visibleInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                  {activeTab === "drafts" ? (
                    <FileText className="w-6 h-6 text-gray-300" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-gray-300" />
                  )}
                </div>
                <p className="text-sm text-gray-400 font-medium">
                  {activeTab === "drafts"
                    ? "No pending invoices"
                    : "No saved invoices"}
                </p>
                <p className="text-xs text-gray-300 mt-1">
                  {activeTab === "drafts"
                    ? "All invoices confirmed!"
                    : "Confirm a draft to save it"}
                </p>
              </div>
            ) : selectedInvoice &&
              activeTab ===
                (selectedInvoice.isConfirmed ? "saved" : "drafts") ? (
              <InvoicePreviewCard
                invoice={selectedInvoice.invoice}
                isConfirmed={selectedInvoice.isConfirmed}
                invoiceNumber={selectedInvoice.invoiceNumber}
                userName={userName}
                onConfirm={() => onConfirm(selectedInvoice.messageId)}
                onEdit={(updated) => onEdit(selectedInvoice.messageId, updated)}
                onDiscard={() => {
                  onDiscard(selectedInvoice.messageId);
                  const remaining = visibleInvoices.filter(
                    (s) => s.messageId !== selectedInvoice.messageId
                  );
                  if (remaining.length > 0) onSelect(remaining[0].messageId);
                }}
              />
            ) : visibleInvoices.length > 0 ? (
              // Show first in current tab if selected doesn't belong here
              <InvoicePreviewCard
                invoice={visibleInvoices[0].invoice}
                isConfirmed={visibleInvoices[0].isConfirmed}
                invoiceNumber={visibleInvoices[0].invoiceNumber}
                userName={userName}
                onConfirm={() => onConfirm(visibleInvoices[0].messageId)}
                onEdit={(updated) =>
                  onEdit(visibleInvoices[0].messageId, updated)
                }
                onDiscard={() => {
                  onDiscard(visibleInvoices[0].messageId);
                  const remaining = visibleInvoices.slice(1);
                  if (remaining.length > 0) onSelect(remaining[0].messageId);
                }}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
