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
import {
  deleteInvoice,
  getUserInvoices,
  updateInvoice,
} from "@/lib/mockInvoiceParser";
import { DeleteInvoiceModal } from "@/components/invoice/DeleteInvoiceModal";
import { EditInvoiceModal } from "@/components/invoice/EditInvoiceModal";
import { LineItem } from "@/components/invoice/InvoicePreviewCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SendInvoiceModal } from "@/components/invoice/SendInvoiceModel";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
type FilterTab = "all" | "draft" | "saved" | "sent" | "paid" | "overdue";

interface Invoice {
  _id: string;
  invoiceNumber: string;
  clientName: string;
  isConfirmed: boolean;
  lineItems?: LineItem[];
  paymentTermsDays?: number;
  workDescription?: string;
  quantity?: number;
  quantityUnit?: string;
  ratePerUnit?: number;
  gstPercent: number;
  subtotal: number;
  gstAmount: number;
  total: number;
  status: InvoiceStatus;
  createdAt: string;
  dueDate: string;
}

// ── UI label based on status + isConfirmed ──
function getDisplayStatus(inv: Invoice): {
  label: string;
  style: string;
} {
  if (inv.status === "sent")
    return { label: "Sent", style: "bg-blue-50 text-blue-600" };
  if (inv.status === "paid")
    return { label: "Paid", style: "bg-emerald-50 text-emerald-600" };
  if (inv.status === "overdue")
    return { label: "Overdue", style: "bg-red-50 text-red-500" };
  // status === "draft"
  if (inv.isConfirmed)
    return { label: "Confirmed", style: "text-emerald-600 bg-emerald-50" };
  return { label: "Draft", style: "bg-gray-100 text-gray-500" };
}

const TABS: { label: string; value: FilterTab }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Confirmed", value: "saved" },
  { label: "Sent", value: "sent" },
  { label: "Paid", value: "paid" },
  { label: "Overdue", value: "overdue" },
];

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-600",
  "bg-emerald-100 text-emerald-600",
  "bg-orange-100 text-orange-600",
  "bg-pink-100 text-pink-600",
  "bg-violet-100 text-violet-600",
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

function getAvatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

// ── Filter logic ──
function matchesTab(inv: Invoice, tab: FilterTab): boolean {
  if (tab === "all") return true;
  if (tab === "draft") return inv.status === "draft" && !inv.isConfirmed;
  if (tab === "saved") return inv.status === "draft" && inv.isConfirmed;
  return inv.status === tab;
}

export function InvoiceListPage() {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
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
  const [sendingInvoice, setSendingInvoice] = useState<Invoice | null>(null);

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
    if (!isLoaded || !user) return;
    (async () => {
      try {
        const data = await getUserInvoices(user.id);
        setInvoices(data);
      } catch (err) {
        console.error("Failed to fetch invoices:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const filtered = invoices.filter((inv) => {
    const matchTab = matchesTab(inv, activeTab);
    const matchSearch =
      inv.clientName.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  // Tab counts
  const tabCounts: Record<FilterTab, number> = {
    all: invoices.length,
    draft: invoices.filter((i) => i.status === "draft" && !i.isConfirmed)
      .length,
    saved: invoices.filter((i) => i.status === "draft" && i.isConfirmed).length,
    sent: invoices.filter((i) => i.status === "sent").length,
    paid: invoices.filter((i) => i.status === "paid").length,
    overdue: invoices.filter((i) => i.status === "overdue").length,
  };

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
          workDescription: inv.workDescription,
          quantity: inv.quantity,
          quantityUnit: inv.quantityUnit,
          ratePerUnit: inv.ratePerUnit,
        },
        inv.invoiceNumber,
        user?.fullName || user?.firstName || "Ledger User"
      );
    } catch (err) {
      console.error("PDF download failed:", err);
    }
  };

  const handleDelete = async (invoiceId: string) => {
    setDeletingId(invoiceId);
    try {
      await deleteInvoice(invoiceId);
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="rounded-lg text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate("/dashboard")}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "#4F46E5" }}
              >
                <Zap className="w-3.5 h-3.5 text-white" fill="white" />
              </div>
              <span className="font-semibold text-gray-900">Ledger</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page header */}
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
          <Button
            onClick={() => navigate("/create")}
            className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all"
            style={{ boxShadow: "0 4px 12px rgba(79,70,229,0.3)" }}
          >
            <Plus className="w-4 h-4" />
            New Invoice
          </Button>
        </div>

        {/* Search + Tabs */}
        <div className="flex items-center gap-6 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl focus-visible:ring-indigo-400"
            />
          </div>

          <div className="flex items-center gap-1">
            {TABS.map((tab) => (
              <Button
                key={tab.value}
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab(tab.value)}
                className={`rounded-lg px-3 text-sm font-medium gap-1.5 ${
                  activeTab === tab.value
                    ? "bg-gray-100 text-gray-900 hover:bg-gray-100"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {tab.label}
                {tabCounts[tab.value] > 0 && (
                  <span
                    className={`text-xs rounded-full px-1.5 py-0 font-bold ${
                      activeTab === tab.value
                        ? "bg-gray-200 text-gray-700"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {tabCounts[tab.value]}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft">
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
                  {[
                    "Invoice",
                    "Client",
                    "Date",
                    "Due Date",
                    "Amount",
                    "Status",
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((inv) => {
                  const display = getDisplayStatus(inv);
                  return (
                    <tr
                      key={inv._id}
                      onClick={() => navigate(`/invoices/${inv._id}`)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-gray-900">
                          {inv.invoiceNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            className={`w-8 h-8 flex-shrink-0 ${getAvatarColor(
                              inv.clientName
                            )}`}
                          >
                            <AvatarFallback
                              className={`text-xs font-bold ${getAvatarColor(
                                inv.clientName
                              )}`}
                            >
                              {inv.clientName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
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
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">
                          {formatDate(inv.createdAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">
                          {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatINR(inv.total)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          className={`capitalize rounded-full text-xs font-medium ${display.style}`}
                        >
                          {display.label}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(
                                openMenuId === inv._id ? null : inv._id
                              );
                            }}
                            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>

                          {openMenuId === inv._id && (
                            <div
                              ref={menuRef}
                              className="absolute right-0 top-8 z-50 bg-white rounded-2xl border border-gray-100 py-1.5 w-44"
                              style={{
                                boxShadow:
                                  "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                              }}
                            >
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  navigate(`/invoices/${inv._id}`);
                                }}
                                className="w-full justify-start gap-3 px-4 py-2.5 h-auto rounded-none text-sm text-gray-700"
                              >
                                <Eye className="w-4 h-4 text-gray-400" />
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => handleDownloadPDF(inv)}
                                className="w-full justify-start gap-3 px-4 py-2.5 h-auto rounded-none text-sm text-gray-700"
                              >
                                <Download className="w-4 h-4 text-gray-400" />
                                Download PDF
                              </Button>

                              {inv.status === "paid" ? (
                                <Button
                                  variant="ghost"
                                  disabled
                                  className="w-full justify-start gap-3 px-4 py-2.5 h-auto rounded-none text-sm text-gray-300 cursor-not-allowed"
                                >
                                  <Lock className="w-4 h-4" />
                                  Locked
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setEditingInvoice(inv);
                                  }}
                                  className="w-full justify-start gap-3 px-4 py-2.5 h-auto rounded-none text-sm text-gray-700"
                                >
                                  <Edit2 className="w-4 h-4 text-gray-400" />
                                  Edit
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  setSendingInvoice(inv);
                                }}
                                className="w-full justify-start gap-3 px-4 py-2.5 h-auto rounded-none text-sm text-gray-700"
                              >
                                <Send className="w-4 h-4 text-gray-400" />
                                Send
                              </Button>

                              <Button
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  setShowDeleteConfirm(inv._id);
                                }}
                                className="w-full justify-start gap-3 px-4 py-2.5 h-auto rounded-none text-sm text-red-500 hover:bg-red-50 hover:text-red-500"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                                Delete
                              </Button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {sendingInvoice && (
        <SendInvoiceModal
          invoiceId={sendingInvoice._id}
          invoiceNumber={sendingInvoice.invoiceNumber}
          clientName={sendingInvoice.clientName}
          total={sendingInvoice.total}
          onClose={() => setSendingInvoice(null)}
          onSent={() => {
            setInvoices((prev) =>
              prev.map((inv) =>
                inv._id === sendingInvoice._id
                  ? { ...inv, status: "sent" }
                  : inv
              )
            );
            setSendingInvoice(null);
          }}
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
