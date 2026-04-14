import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import {
  ArrowLeft,
  Edit2,
  Download,
  Send,
  Mail,
  Copy,
  Zap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { fetchInvoiceById } from "@/lib/mockInvoiceParser";
import { downloadInvoicePDF } from "@/lib/downloadPDF";
import { EditInvoiceModal } from "@/components/invoice/EditInvoiceModal";
import { updateInvoice } from "@/lib/mockInvoiceParser";
import { LineItem } from "@/components/invoice/InvoicePreviewCard";

interface Invoice {
  _id: string;
  invoiceNumber: string;
  clientName: string;
  // New format
  lineItems?: LineItem[];
  paymentTermsDays?: number;
  // Legacy format
  workDescription?: string;
  quantity?: number;
  quantityUnit?: string;
  ratePerUnit?: number;
  // Common fields
  gstPercent: number;
  subtotal: number;
  gstAmount: number;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue";
  createdAt: string;
  dueDate: string;
  originalPrompt?: string;
}

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    class: "bg-gray-100 text-gray-600",
    dot: "bg-gray-400",
  },
  sent: {
    label: "Sent",
    class: "bg-blue-50 text-blue-600",
    dot: "bg-blue-500",
  },
  paid: {
    label: "Paid",
    class: "bg-emerald-50 text-emerald-600",
    dot: "bg-emerald-500",
  },
  overdue: {
    label: "Overdue",
    class: "bg-red-50 text-red-500",
    dot: "bg-red-500",
  },
};

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getDaysUntilDue(dueDate: string) {
  const due = new Date(dueDate);
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function InvoiceViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchInvoiceById(id)
      .then((invoice) => {
        setInvoice(invoice);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownload = async () => {
    if (!invoice) return;
    await downloadInvoicePDF(
      {
        clientName: invoice.clientName,
        lineItems: invoice.lineItems || [],
        gstPercent: invoice.gstPercent,
        paymentTermsDays: invoice.paymentTermsDays || 15,
        subtotal: invoice.subtotal,
        gstAmount: invoice.gstAmount,
        total: invoice.total,
        // Legacy fallback
        workDescription: invoice.workDescription,
        quantity: invoice.quantity,
        quantityUnit: invoice.quantityUnit,
        ratePerUnit: invoice.ratePerUnit,
      },
      invoice.invoiceNumber,
      user?.fullName || "InvoiceOS User"
    );
  };

  const handleSaveEdit = async (invoiceId: string, data: Partial<Invoice>) => {
    await updateInvoice(invoiceId, data);
    setInvoice((prev) => (prev ? { ...prev, ...data } : prev));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900 font-semibold">Invoice not found</p>
          <button
            onClick={() => navigate("/invoices")}
            className="text-indigo-600 text-sm mt-2 hover:underline"
          >
            Back to invoices
          </button>
        </div>
      </div>
    );
  }

  const status = STATUS_CONFIG[invoice.status];
  const daysUntilDue = invoice.dueDate
    ? getDaysUntilDue(invoice.dueDate)
    : null;
  const isDraft = invoice.status === "draft";
  const isPaid = invoice.status === "paid";

  // Determine if invoice has new lineItems format or old format
  const hasLineItems = invoice.lineItems && invoice.lineItems.length > 0;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "#4F46E5" }}
              >
                <Zap className="w-3.5 h-3.5 text-white" fill="white" />
              </div>
              <span className="font-semibold text-gray-900">InvoiceOS</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDraft && (
              <button
                disabled
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-400 border border-gray-200 cursor-not-allowed"
                title="Send feature coming soon"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            )}
            {!isPaid && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            )}
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
              style={{
                background: "#4F46E5",
                boxShadow: "0 4px 12px rgba(79,70,229,0.3)",
              }}
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page heading */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {invoice.invoiceNumber}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${status.class}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>
          <p className="text-sm text-gray-400">
            Created on {formatDate(invoice.createdAt)}
            {invoice.dueDate && (
              <span> · Due {formatDate(invoice.dueDate)}</span>
            )}
          </p>
        </div>

        {/* Main layout — 70/30 */}
        <div className="flex gap-6 items-start">
          {/* ── Left 70% ── */}
          <div
            id="invoice-print-area"
            className="flex-1 bg-white rounded-2xl border border-gray-100 overflow-hidden"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
          >
            {/* Invoice gradient header */}
            <div
              className="px-8 py-7"
              style={{
                background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/30">
                    <Zap className="w-5 h-5 text-white" fill="white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">InvoiceOS</p>
                    <p className="text-indigo-200 text-xs">Smart Invoicing</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-indigo-200 text-xs uppercase tracking-widest mb-1">
                    Invoice
                  </p>
                  <p className="text-white font-bold text-xl">
                    {invoice.invoiceNumber}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-8 py-6">
              {/* From / To / Date */}
              <div className="grid grid-cols-3 gap-6 pb-6 border-b border-gray-100">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    From
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {user?.fullName || "InvoiceOS User"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">via InvoiceOS</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Bill To
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {invoice.clientName}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Dates
                  </p>
                  <p className="text-xs text-gray-600">
                    <span className="text-gray-400">Issued: </span>
                    {formatDate(invoice.createdAt)}
                  </p>
                  {invoice.dueDate && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      <span className="text-gray-400">Due: </span>
                      {formatDate(invoice.dueDate)}
                    </p>
                  )}
                </div>
              </div>

              {/* Line items table */}
              <div className="mt-6">
                <div className="grid grid-cols-12 gap-4 px-4 py-2.5 bg-gray-50 rounded-xl mb-2">
                  <div className="col-span-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Description
                    </p>
                  </div>
                  <div className="col-span-2 text-center">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Qty
                    </p>
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Rate
                    </p>
                  </div>
                  <div className="col-span-3 text-right">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Amount
                    </p>
                  </div>
                </div>

                {/* New format — multiple line items */}
                {hasLineItems ? (
                  invoice.lineItems!.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-4 px-4 py-4 border-b border-gray-100"
                    >
                      <div className="col-span-5">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.description}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Professional Services
                        </p>
                      </div>
                      <div className="col-span-2 text-center">
                        <p className="text-sm text-gray-600">
                          {item.quantity} {item.unit}
                        </p>
                      </div>
                      <div className="col-span-2 text-right">
                        <p className="text-sm text-gray-600">
                          {formatINR(item.rate)}
                        </p>
                      </div>
                      <div className="col-span-3 text-right">
                        <p className="text-sm font-bold text-gray-900">
                          {formatINR(item.amount)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  // Legacy format — single line item
                  <div className="grid grid-cols-12 gap-4 px-4 py-4 border-b border-gray-100">
                    <div className="col-span-5">
                      <p className="text-sm font-semibold text-gray-900">
                        {invoice.workDescription}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Professional Services
                      </p>
                    </div>
                    <div className="col-span-2 text-center">
                      <p className="text-sm text-gray-600">
                        {invoice.quantity} {invoice.quantityUnit}
                      </p>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="text-sm text-gray-600">
                        {formatINR(invoice.ratePerUnit || 0)}
                      </p>
                    </div>
                    <div className="col-span-3 text-right">
                      <p className="text-sm font-bold text-gray-900">
                        {formatINR(invoice.subtotal)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-700 font-medium">
                      {formatINR(invoice.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      GST ({invoice.gstPercent}%)
                    </span>
                    <span className="text-gray-700 font-medium">
                      {formatINR(invoice.gstAmount)}
                    </span>
                  </div>
                  {invoice.paymentTermsDays && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Payment Terms</span>
                      <span className="text-gray-700 font-medium">
                        {invoice.paymentTermsDays} days
                      </span>
                    </div>
                  )}
                  <div
                    className="flex justify-between items-center px-4 py-3 rounded-xl mt-2"
                    style={{
                      background:
                        "linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)",
                    }}
                  >
                    <span className="text-sm font-bold text-indigo-900">
                      Total Due
                    </span>
                    <span className="text-lg font-bold text-indigo-600">
                      {formatINR(invoice.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 text-center">
                  Generated by InvoiceOS · Thank you for your business!
                </p>
              </div>
            </div>
          </div>

          {/* ── Right 30% ── */}
          <div className="w-72 flex-shrink-0 space-y-4">
            {/* Client card */}
            <div
              className="bg-white rounded-2xl border border-gray-100 p-5"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
                Client
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                  {invoice.clientName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {invoice.clientName}
                  </p>
                  <p className="text-xs text-gray-400">Client</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Client details like email and phone will be available when you
                  Send the Invoice.
                </p>
              </div>
            </div>

            {/* Actions card */}
            <div
              className="bg-white rounded-2xl border border-gray-100 p-5"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
                Actions
              </p>
              <div className="space-y-2">
                <button
                  onClick={handleDownload}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4 text-gray-400" />
                  Download PDF
                </button>
                <button
                  disabled
                  title="Add client email first"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-300 border border-gray-100 cursor-not-allowed"
                >
                  <Mail className="w-4 h-4 text-gray-300" />
                  Email to Client
                </button>
                <button
                  disabled
                  title="Payment gateway coming soon"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-300 border border-gray-100 cursor-not-allowed"
                >
                  <Copy className="w-4 h-4 text-gray-300" />
                  Copy Payment Link
                </button>
              </div>
              <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="font-medium text-gray-500">
                    Payment Link
                  </span>{" "}
                  — a shareable URL your client clicks to pay online. Requires
                  payment gateway setup.
                </p>
              </div>
            </div>

            {/* Status card */}
            {invoice.status === "draft" && (
              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <p className="text-sm font-semibold text-gray-600">Draft</p>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  This invoice hasn't been sent yet. Edit and confirm all
                  details before sending.
                </p>
              </div>
            )}

            {invoice.status === "sent" && daysUntilDue !== null && (
              <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <p className="text-sm font-semibold text-blue-700">
                    Awaiting Payment
                  </p>
                </div>
                <p className="text-xs text-blue-600 leading-relaxed">
                  {daysUntilDue > 0
                    ? `Due in ${daysUntilDue} day${
                        daysUntilDue !== 1 ? "s" : ""
                      } — ${formatDate(invoice.dueDate)}`
                    : "Due today!"}
                </p>
              </div>
            )}

            {invoice.status === "paid" && (
              <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <p className="text-sm font-semibold text-emerald-700">
                    Payment Received
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-emerald-600">Amount</span>
                    <span className="font-semibold text-emerald-700">
                      {formatINR(invoice.total)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-emerald-600">Invoice</span>
                    <span className="font-semibold text-emerald-700">
                      {invoice.invoiceNumber}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {invoice.status === "overdue" && daysUntilDue !== null && (
              <div className="bg-red-50 rounded-2xl border border-red-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <p className="text-sm font-semibold text-red-700">
                    Payment Overdue
                  </p>
                </div>
                <p className="text-xs text-red-600 leading-relaxed">
                  Due on {formatDate(invoice.dueDate)}. Overdue by{" "}
                  {Math.abs(daysUntilDue)} day
                  {Math.abs(daysUntilDue) !== 1 ? "s" : ""}.
                </p>
                <button className="mt-3 w-full py-2 rounded-xl text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
                  Send Reminder
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {editing && (
        <EditInvoiceModal
          invoice={invoice}
          onSave={handleSaveEdit}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
