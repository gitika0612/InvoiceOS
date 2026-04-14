import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import {
  Plus,
  Search,
  FileText,
  MoreHorizontal,
  Zap,
  ArrowLeft,
  Eye,
  Download,
  Send,
  Trash2,
  Lock,
  Edit2,
} from "lucide-react";
import { downloadInvoicePDF } from "@/lib/downloadPDF";
import { deleteInvoice, getUserInvoices } from "@/lib/mockInvoiceParser";
import { DeleteInvoiceModal } from "@/components/invoice/DeleteInvoiceModal";
import { EditInvoiceModal } from "@/components/invoice/EditInvoiceModal";
import { updateInvoice } from "@/lib/mockInvoiceParser";
import { LineItem } from "@/components/invoice/InvoicePreviewCard";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
type FilterTab = "all" | InvoiceStatus;

interface Invoice {
  _id: string;
  invoiceNumber: string;
  clientName: string;
  // New format
  lineItems?: LineItem[];
  paymentTermsDays?: number;
  // Legacy
  workDescription?: string;
  quantity?: number;
  quantityUnit?: string;
  ratePerUnit?: number;
  // Common
  gstPercent: number;
  subtotal: number;
  gstAmount: number;
  total: number;
  status: InvoiceStatus;
  createdAt: string;
  dueDate: string;
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-50 text-blue-600",
  paid: "bg-emerald-50 text-emerald-600",
  overdue: "bg-red-50 text-red-500",
};

const TABS: { label: string; value: FilterTab }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
  { label: "Paid", value: "paid" },
  { label: "Overdue", value: "overdue" },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-600",
  "bg-emerald-100 text-emerald-600",
  "bg-orange-100 text-orange-600",
  "bg-pink-100 text-pink-600",
  "bg-violet-100 text-violet-600",
];

function getAvatarColor(name: string) {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export function InvoiceListPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const data = await getUserInvoices(user.id);
        setInvoices(data);
      } catch (err) {
        console.error("Failed to fetch invoices:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  const filtered = invoices.filter((inv) => {
    const matchTab = activeTab === "all" || inv.status === activeTab;
    const matchSearch =
      inv.clientName.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const handleDownloadPDF = async (inv: Invoice) => {
    setOpenMenuId(null);
    try {
      await downloadInvoicePDF(
        {
          clientName: inv.clientName,
          lineItems: inv.lineItems || [],
          paymentTermsDays: inv.paymentTermsDays || 15,
          gstPercent: inv.gstPercent,
          subtotal: inv.subtotal,
          gstAmount: inv.gstAmount,
          total: inv.total,
          // Legacy fallback
          workDescription: inv.workDescription,
          quantity: inv.quantity,
          quantityUnit: inv.quantityUnit,
          ratePerUnit: inv.ratePerUnit,
        },
        inv.invoiceNumber,
        user?.fullName || user?.firstName || "InvoiceOS User"
      );
    } catch (err) {
      console.error("PDF download failed:", err);
    }
  };

  const handleDelete = async (invoiceId: string) => {
    setDeletingId(invoiceId);
    try {
      await deleteInvoice(invoiceId);
      // Remove from local state immediately
      setInvoices((prev) => prev.filter((inv) => inv._id !== invoiceId));
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveEdit = async (id: string, data: Partial<Invoice>) => {
    await updateInvoice(id, data);
    // Update local state
    setInvoices((prev) =>
      prev.map((inv) => (inv._id === id ? { ...inv, ...data } : inv))
    );
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
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
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              All Invoices
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {loading
                ? "Loading..."
                : `${invoices.length} total invoice${
                    invoices.length !== 1 ? "s" : ""
                  }`}
            </p>
          </div>
          <button
            onClick={() => navigate("/create")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
            style={{
              background: "#4F46E5",
              boxShadow: "0 4px 12px rgba(79,70,229,0.3)",
            }}
          >
            <Plus className="w-4 h-4" />
            New Invoice
          </button>
        </div>

        {/* ── Search + Tabs row ── */}
        <div className="flex items-center gap-6 mb-6">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 transition-all"
            />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.value
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft">
          {" "}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-900">
                No invoices found
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {search
                  ? "Try a different search term"
                  : "Create your first invoice to get started"}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Invoice
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Client
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Date
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Due Date
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Amount
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((inv) => (
                  <tr
                    key={inv._id}
                    onClick={() => navigate(`/invoices/${inv._id}`)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    {/* Invoice number */}
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-gray-900">
                        {inv.invoiceNumber}
                      </span>
                    </td>

                    {/* Client */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${getAvatarColor(
                            inv.clientName
                          )}`}
                        >
                          {getInitial(inv.clientName)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {inv.clientName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {inv.lineItems && inv.lineItems.length > 0
                              ? inv.lineItems[0].description
                              : inv.workDescription || "—"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {formatDate(inv.createdAt)}
                      </span>
                    </td>

                    {/* Due date */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatINR(inv.total)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                          STATUS_STYLES[inv.status]
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(
                              openMenuId === inv._id ? null : inv._id
                            );
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {openMenuId === inv._id && (
                          <div
                            ref={menuRef}
                            className="absolute right-0 top-8 z-50 bg-white rounded-2xl border border-gray-100 py-1.5 w-44"
                            style={{
                              boxShadow:
                                "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                            }}
                          >
                            {/* View */}
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                navigate(`/invoices/${inv._id}`);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Eye className="w-4 h-4 text-gray-400" />
                              View
                            </button>

                            {/* Download PDF */}
                            <button
                              onClick={() => handleDownloadPDF(inv)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Download className="w-4 h-4 text-gray-400" />
                              Download PDF
                            </button>

                            {/* Edit — show based on status */}
                            {inv.status === "paid" ? (
                              <button
                                disabled
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 cursor-not-allowed"
                                title="Paid invoices cannot be edited"
                              >
                                <Lock className="w-4 h-4 text-gray-300" />
                                Locked
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setEditingInvoice(inv);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <Edit2 className="w-4 h-4 text-gray-400" />
                                Edit
                              </button>
                            )}

                            {/* Send — disabled */}
                            <button
                              disabled
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 cursor-not-allowed"
                            >
                              <Send className="w-4 h-4 text-gray-300" />
                              Send
                            </button>

                            <div className="my-1 border-t border-gray-100" />

                            {/* Delete */}
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                setShowDeleteConfirm(inv._id);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {editingInvoice && (
        <EditInvoiceModal
          invoice={editingInvoice}
          onSave={handleSaveEdit}
          onClose={() => setEditingInvoice(null)}
        />
      )}

      {showDeleteConfirm && (
        <DeleteInvoiceModal
          invoiceNumber={
            invoices.find((inv) => inv._id === showDeleteConfirm)
              ?.invoiceNumber || ""
          }
          isDeleting={!!deletingId}
          onConfirm={() => handleDelete(showDeleteConfirm)}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
