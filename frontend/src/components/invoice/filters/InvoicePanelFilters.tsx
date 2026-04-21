import { useState, useRef, useEffect } from "react";
import {
  Search,
  X,
  ChevronRight,
  Calendar,
  User,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type FilterPane = "client" | "month" | null;

function parseMonthKey(key: string): Date {
  const months: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };
  const parts = key.toLowerCase().split(" ");
  const month = months[parts[0]] ?? 0;
  const year = parseInt(parts[1]) || new Date().getFullYear();
  return new Date(year, month, 1);
}

function isCurrentMonth(key: string): boolean {
  const current = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  return key.toLowerCase() === current.toLowerCase();
}

function isFutureMonth(key: string): boolean {
  const date = parseMonthKey(key);
  const currentStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );
  return date.getTime() > currentStart.getTime();
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onChange}
      className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-left group"
    >
      <div
        className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
          checked
            ? "bg-indigo-500 border-indigo-500"
            : "border-gray-300 group-hover:border-indigo-300"
        }`}
      >
        {checked && (
          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
        )}
      </div>
      <span className="text-xs text-gray-700 truncate">{label}</span>
    </button>
  );
}

interface InvoicePanelFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  selectedClients: Set<string>;
  onToggleClient: (client: string) => void;
  onClearClients: () => void;
  selectedMonths: Set<string>;
  onToggleMonth: (month: string) => void;
  onClearMonths: () => void;
  onClearAll: () => void;
  allClients: string[];
  allMonths: string[];
  activeFilterCount: number;
}

export function InvoicePanelFilters({
  search,
  onSearchChange,
  selectedClients,
  onToggleClient,
  onClearClients,
  selectedMonths,
  onToggleMonth,
  onClearMonths,
  onClearAll,
  allClients,
  allMonths,
  activeFilterCount,
}: InvoicePanelFiltersProps) {
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [activeFilterPane, setActiveFilterPane] = useState<FilterPane>(null);
  const [clientSearch, setClientSearch] = useState("");
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterMenu(false);
        setActiveFilterPane(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredClients = allClients.filter((c) =>
    c.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const hasFilters =
    search || selectedClients.size > 0 || selectedMonths.size > 0;

  return (
    <div className="px-3 pb-3 space-y-2">
      {/* Search + filter + sort row */}
      <div className="flex gap-1.5">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          <input
            placeholder="Search client or invoice..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-7 pr-7 h-8 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter button */}
        <div ref={filterRef} className="relative flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setShowFilterMenu(!showFilterMenu);
              if (showFilterMenu) setActiveFilterPane(null);
            }}
            className={`h-8 w-8 rounded-lg border relative ${
              showFilterMenu || activeFilterCount > 0
                ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                : "border-gray-200 bg-gray-50 text-gray-500"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {/* Dropdown */}
          {showFilterMenu && (
            <div className="absolute right-0 top-10 z-50 flex shadow-xl rounded-xl overflow-hidden border border-gray-100">
              {/* Left pane */}
              <div className="w-36 bg-white border-r border-gray-100 py-1">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-3 py-2">
                  Filter by
                </p>

                {/* Client */}
                <button
                  onClick={() =>
                    setActiveFilterPane(
                      activeFilterPane === "client" ? null : "client"
                    )
                  }
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors ${
                    activeFilterPane === "client"
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3" />
                    <span>Client</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedClients.size > 0 && (
                      <span className="w-4 h-4 bg-indigo-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {selectedClients.size}
                      </span>
                    )}
                    <ChevronRight className="w-3 h-3 text-gray-400" />
                  </div>
                </button>

                {/* Month */}
                <button
                  onClick={() =>
                    setActiveFilterPane(
                      activeFilterPane === "month" ? null : "month"
                    )
                  }
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors ${
                    activeFilterPane === "month"
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    <span>Month</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedMonths.size > 0 && (
                      <span className="w-4 h-4 bg-indigo-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {selectedMonths.size}
                      </span>
                    )}
                    <ChevronRight className="w-3 h-3 text-gray-400" />
                  </div>
                </button>

                {/* Clear all */}
                {hasFilters && (
                  <div className="border-t border-gray-100 mt-1 pt-1 px-3 pb-1">
                    <button
                      onClick={() => {
                        onClearAll();
                        setShowFilterMenu(false);
                        setActiveFilterPane(null);
                      }}
                      className="text-[10px] text-red-400 hover:text-red-600 font-medium"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>

              {/* Client pane */}
              {activeFilterPane === "client" && (
                <div
                  className="w-52 bg-white flex flex-col"
                  style={{ maxHeight: "320px" }}
                >
                  <div className="px-3 pt-3 pb-2 border-b border-gray-100 flex-shrink-0">
                    <p className="text-xs font-bold text-gray-700 mb-2">
                      All Clients
                    </p>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                      <input
                        autoFocus
                        placeholder="Search clients..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="w-full pl-7 pr-3 h-7 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
                      />
                    </div>
                  </div>

                  <div className="px-2 py-1.5 border-b border-gray-50 flex-shrink-0">
                    <Checkbox
                      checked={selectedClients.size === 0}
                      onChange={onClearClients}
                      label="All clients"
                    />
                  </div>

                  <div className="overflow-y-auto flex-1 px-2 py-1">
                    {filteredClients.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">
                        No clients found
                      </p>
                    ) : (
                      filteredClients.map((client) => (
                        <Checkbox
                          key={client}
                          checked={selectedClients.has(client)}
                          onChange={() => onToggleClient(client)}
                          label={client}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Month pane */}
              {activeFilterPane === "month" && (
                <div
                  className="w-52 bg-white flex flex-col"
                  style={{ maxHeight: "320px" }}
                >
                  <div className="px-3 pt-3 pb-2 border-b border-gray-100 flex-shrink-0">
                    <p className="text-xs font-bold text-gray-700">
                      All Months
                    </p>
                  </div>

                  <div className="px-2 py-1.5 border-b border-gray-50 flex-shrink-0">
                    <Checkbox
                      checked={selectedMonths.size === 0}
                      onChange={onClearMonths}
                      label="All months"
                    />
                  </div>

                  <div className="overflow-y-auto flex-1 px-2 py-1">
                    {allMonths.map((month) => {
                      const isCurrent = isCurrentMonth(month);
                      const isFuture = isFutureMonth(month);
                      return (
                        <button
                          key={month}
                          onClick={() => onToggleMonth(month)}
                          className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                        >
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                              selectedMonths.has(month)
                                ? "bg-indigo-500 border-indigo-500"
                                : "border-gray-300 group-hover:border-indigo-300"
                            }`}
                          >
                            {selectedMonths.has(month) && (
                              <Check
                                className="w-2.5 h-2.5 text-white"
                                strokeWidth={3}
                              />
                            )}
                          </div>
                          <span className="text-xs text-gray-700 flex-1 truncate">
                            {month}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1 py-0.5 rounded flex-shrink-0">
                              Now
                            </span>
                          )}
                          {isFuture && (
                            <span className="text-[9px] font-bold text-blue-400 bg-blue-50 px-1 py-0.5 rounded flex-shrink-0">
                              Soon
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
