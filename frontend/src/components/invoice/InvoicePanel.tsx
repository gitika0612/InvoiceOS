import { useState, useMemo } from "react";
import {
  FileText,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
} from "lucide-react";
import { ParsedInvoice } from "./InvoicePreviewCard";
import { InvoicePreviewCard } from "./InvoicePreviewCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  activeTab?: "draft" | "confirmed"; // ← new prop
  onConfirm: (messageId: string) => void;
  onDiscard: (messageId: string) => void;
  onEdit: (messageId: string, updated: ParsedInvoice) => void;
  onSelect: (messageId: string | null) => void;
  userName?: string;
}

type SortOption = "newest" | "oldest" | "highest" | "lowest" | "az";
type StatusFilter = "draft" | "confirmed";

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getGroupKey(si: SessionInvoice): string {
  if (si.invoice.invoiceMonth) return si.invoice.invoiceMonth;
  return new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function InvoicePanel({
  sessionInvoices,
  selectedMessageId,
  activeTab,
  onConfirm,
  onDiscard,
  onEdit,
  onSelect,
  userName,
}: InvoicePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [userSelectedTab, setUserSelectedTab] = useState<StatusFilter | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterClient, setFilterClient] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});

  const drafts = [...sessionInvoices.filter((s) => !s.isConfirmed)].reverse();
  const confirmed = [...sessionInvoices.filter((s) => s.isConfirmed)].reverse();

  // ── Tab priority: activeTab (from parent) > userSelectedTab > defaultTab ──
  const latestInvoice = sessionInvoices[sessionInvoices.length - 1];
  const defaultTab: StatusFilter = latestInvoice?.isConfirmed
    ? "confirmed"
    : "draft";
  const manualTab: StatusFilter = activeTab ?? userSelectedTab ?? defaultTab;

  const baseList = manualTab === "draft" ? drafts : confirmed;

  const filtered = useMemo(
    () =>
      baseList.filter((si) => {
        const q = search.toLowerCase();
        const matchSearch =
          si.invoice.clientName.toLowerCase().includes(q) ||
          (si.invoiceNumber || "").toLowerCase().includes(q);
        const matchClient = filterClient
          ? si.invoice.clientName === filterClient
          : true;
        return matchSearch && matchClient;
      }),
    [baseList, search, filterClient]
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        switch (sortBy) {
          case "newest":
            // MongoDB ObjectId contains timestamp in first 4 bytes
            // Compare dbMessageId lexicographically (later IDs are lexicographically greater)
            return b.dbMessageId.localeCompare(a.dbMessageId);
          case "oldest":
            return a.dbMessageId.localeCompare(b.dbMessageId);
          case "highest":
            return b.invoice.total - a.invoice.total;
          case "lowest":
            return a.invoice.total - b.invoice.total;
          case "az":
            return a.invoice.clientName.localeCompare(b.invoice.clientName);
          default:
            return 0;
        }
      }),
    [filtered, sortBy]
  );

  const grouped = useMemo(() => {
    const groups: Record<string, SessionInvoice[]> = {};
    sorted.forEach((si) => {
      const key = getGroupKey(si);
      if (!groups[key]) groups[key] = [];
      groups[key].push(si);
    });
    return groups;
  }, [sorted]);

  const hasFilters = search || filterClient;
  const clearFilters = () => {
    setSearch("");
    setFilterClient("");
  };
  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  if (sessionInvoices.length === 0) return null;

  return (
    <div
      className={`
      relative flex flex-col border-l border-gray-100 bg-[#FCFCFC]
      transition-all duration-300 flex-shrink-0 h-full
      ${collapsed ? "w-10" : "w-[450px]"}
    `}
    >
      <div className="absolute top-3 right-2 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="w-7 h-7 text-gray-400 hover:text-gray-600"
        >
          {collapsed ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </Button>
      </div>

      {!collapsed && (
        <>
          <div className="flex-shrink-0 bg-white border-b border-gray-100">
            <div className="px-4 pt-3 pb-2 pr-10">
              <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                Session Invoices
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {sessionInvoices.length} invoice
                {sessionInvoices.length !== 1 ? "s" : ""} · {drafts.length}{" "}
                draft{drafts.length !== 1 ? "s" : ""} · {confirmed.length}{" "}
                confirmed
              </p>
            </div>

            <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto">
              {(
                [
                  { key: "draft", label: "Draft", count: drafts.length },
                  {
                    key: "confirmed",
                    label: "Confirmed",
                    count: confirmed.length,
                  },
                ] as const
              ).map(({ key, label, count }) => (
                <Badge
                  key={key}
                  variant="outline"
                  onClick={() => {
                    setUserSelectedTab(key);
                    const list = key === "draft" ? drafts : confirmed;
                    onSelect(list.length > 0 ? list[0].messageId : null);
                  }}
                  className={`
                  cursor-pointer flex-shrink-0 gap-1.5 rounded-full px-2.5 py-1
                  text-xs font-semibold transition-all select-none
                  ${
                    manualTab === key
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                      : "bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200"
                  }
                `}
                >
                  {label}
                  <span
                    className={`
                    flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold
                    ${
                      manualTab === key
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-white text-gray-500"
                    }
                  `}
                  >
                    {count}
                  </span>
                </Badge>
              ))}
            </div>

            <div className="px-3 pb-2 flex gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                <Input
                  placeholder="Search client, invoice number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-7 pr-7 h-8 text-xs bg-gray-50 border-gray-200 rounded-lg focus-visible:ring-indigo-400"
                />
                {search && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSearch("")}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <Select
                value={sortBy}
                onValueChange={(val) => setSortBy(val as SortOption)}
              >
                <SelectTrigger className="w-28 h-8 text-xs bg-gray-50 border-gray-200 rounded-lg focus:ring-indigo-400 gap-1">
                  <ArrowUpDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="highest">Highest</SelectItem>
                  <SelectItem value="lowest">Lowest</SelectItem>
                  <SelectItem value="az">A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="py-2 bg-white">
              {sorted.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                    <FileText className="w-6 h-6 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400 font-medium">
                    No invoices found
                  </p>
                  <p className="text-xs text-gray-300 mt-1">
                    {hasFilters
                      ? "Use search or filters to find invoices"
                      : `No ${manualTab} invoices yet`}
                  </p>
                  {hasFilters && (
                    <Button
                      variant="link"
                      onClick={clearFilters}
                      className="text-xs text-indigo-500 mt-1 h-auto p-0"
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                Object.entries(grouped).map(([group, items]) => {
                  const isGroupCollapsed = collapsedGroups[group];
                  return (
                    <div key={group} className="mb-1">
                      {Object.keys(grouped).length > 1 && (
                        <Button
                          variant="ghost"
                          onClick={() => toggleGroup(group)}
                          className="w-full justify-between px-4 py-2 h-auto rounded-none text-xs hover:bg-gray-100"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            <span className="font-bold text-gray-500 uppercase tracking-wide">
                              {group}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-xs px-1.5 py-0 h-4 rounded-full font-normal"
                            >
                              {items.length}
                            </Badge>
                          </div>
                          {isGroupCollapsed ? (
                            <ChevronDown className="w-3 h-3 text-gray-400" />
                          ) : (
                            <ChevronUp className="w-3 h-3 text-gray-400" />
                          )}
                        </Button>
                      )}

                      {!isGroupCollapsed &&
                        items.map((si) => {
                          const isSelected = selectedMessageId === si.messageId;
                          return (
                            <div key={si.messageId} className="px-3 mb-1.5">
                              <div className="rounded-xl border border-gray-200 bg-white hover:shadow-[0_6px_20px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-200">
                                <button
                                  onClick={() =>
                                    onSelect(isSelected ? null : si.messageId)
                                  }
                                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors
                                  ${
                                    isSelected
                                      ? "bg-[#FAFAFA]"
                                      : "bg-white hover:bg-gray-50"
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="flex">
                                          <p
                                            className={`text-xs font-bold tracking-wide ${
                                              isSelected
                                                ? "text-gray-900"
                                                : "text-gray-500"
                                            }`}
                                          >
                                            {si.invoiceNumber}
                                          </p>
                                          {si.isConfirmed ? (
                                            <Badge className="ml-2 text-xs font-medium text-emerald-600 bg-emerald-50 border-emerald-100 px-2 py-0 rounded-full">
                                              Confirmed
                                            </Badge>
                                          ) : (
                                            <Badge
                                              variant="secondary"
                                              className="ml-2 text-xs font-medium px-2 py-0 rounded-full"
                                            >
                                              Draft
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-sm font-semibold mt-0.5 truncate text-gray-900">
                                          {si.invoice.clientName}
                                        </p>
                                      </div>
                                      <p className="text-sm font-semibold text-gray-900 flex-shrink-0">
                                        {formatINR(si.invoice.total)}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <div
                                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                          si.isConfirmed
                                            ? "bg-emerald-400"
                                            : "bg-amber-400"
                                        }`}
                                      />
                                      <p className="text-xs text-gray-400">
                                        {si.isConfirmed ? "Confirmed" : "Draft"}{" "}
                                        · {si.invoice.lineItems?.length || 0}{" "}
                                        item
                                        {(si.invoice.lineItems?.length || 0) !==
                                        1
                                          ? "s"
                                          : ""}{" "}
                                        · GST {si.invoice.gstPercent}%
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex-shrink-0 mt-1">
                                    {isSelected ? (
                                      <ChevronUp className="w-3.5 h-3.5 text-indigo-400" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5 text-gray-300" />
                                    )}
                                  </div>
                                </button>

                                {isSelected && (
                                  <div className="border-t border-gray-100">
                                    {/* ── Scrollable invoice card — fills to bottom ── */}
                                    <div
                                      className="p-3 overflow-y-auto"
                                      style={{ height: "calc(100vh - 234px)" }}
                                    >
                                      <InvoicePreviewCard
                                        invoice={si.invoice}
                                        isConfirmed={si.isConfirmed}
                                        invoiceId={si.invoiceId}
                                        invoiceNumber={si.invoiceNumber}
                                        userName={userName}
                                        onConfirm={() =>
                                          onConfirm(si.messageId)
                                        }
                                        onEdit={(updated) =>
                                          onEdit(si.messageId, updated)
                                        }
                                        onDiscard={() => {
                                          onDiscard(si.messageId);
                                          const remaining = sorted.filter(
                                            (s) => s.messageId !== si.messageId
                                          );
                                          onSelect(
                                            remaining.length > 0
                                              ? remaining[0].messageId
                                              : null
                                          );
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
