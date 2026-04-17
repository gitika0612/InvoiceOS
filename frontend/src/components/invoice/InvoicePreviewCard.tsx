import { useState } from "react";
import { Check, Edit2, Plus, Trash2, Calendar } from "lucide-react";
import { DownloadPDFButton } from "./pdf/DownloadPDFButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export interface LineItem {
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface ParsedInvoice {
  clientName: string;
  lineItems: LineItem[];
  gstPercent: number;
  paymentTermsDays: number;
  subtotal: number;
  gstAmount: number;
  total: number;
  invoiceDate?: string;
  invoiceMonth?: string;
  workDescription?: string;
  quantity?: number;
  quantityUnit?: string;
  ratePerUnit?: number;
}

interface InvoicePreviewCardProps {
  invoice: ParsedInvoice;
  onConfirm: (invoice: ParsedInvoice) => void;
  onEdit: (invoice: ParsedInvoice) => void;
  onDiscard: () => void;
  isConfirmed?: boolean;
  invoiceNumber?: string;
  userName?: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getInvoiceDates(invoice: ParsedInvoice) {
  const issueDate = invoice.invoiceDate
    ? new Date(invoice.invoiceDate)
    : new Date();
  const dueDate = new Date(
    issueDate.getTime() + (invoice.paymentTermsDays || 15) * 24 * 60 * 60 * 1000
  );
  return {
    issueDate: issueDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    dueDate: dueDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
}

export function InvoicePreviewCard({
  invoice,
  onConfirm,
  onEdit,
  isConfirmed = false,
  invoiceNumber,
  userName,
}: InvoicePreviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedInvoice, setEditedInvoice] = useState(invoice);

  const recalculateTotals = (updated: ParsedInvoice): ParsedInvoice => {
    const subtotal = updated.lineItems.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    const gstAmount = Math.round((subtotal * updated.gstPercent) / 100);
    const total = subtotal + gstAmount;
    return { ...updated, subtotal, gstAmount, total };
  };

  const handleLineItemChange = (
    index: number,
    field: keyof LineItem,
    value: string | number
  ) => {
    const updatedItems = editedInvoice.lineItems.map((item, i) => {
      if (i !== index) return item;
      const updated = {
        ...item,
        [field]:
          typeof value === "string" && !isNaN(Number(value))
            ? Number(value)
            : value,
      };
      updated.amount = Math.round(
        Number(updated.quantity) * Number(updated.rate)
      );
      return updated;
    });
    setEditedInvoice(
      recalculateTotals({ ...editedInvoice, lineItems: updatedItems })
    );
  };

  const handleAddLineItem = () => {
    const newItem: LineItem = {
      description: "",
      quantity: 1,
      unit: "item",
      rate: 0,
      amount: 0,
    };
    setEditedInvoice({
      ...editedInvoice,
      lineItems: [...editedInvoice.lineItems, newItem],
    });
  };

  const handleRemoveLineItem = (index: number) => {
    const updatedItems = editedInvoice.lineItems.filter((_, i) => i !== index);
    setEditedInvoice(
      recalculateTotals({ ...editedInvoice, lineItems: updatedItems })
    );
  };

  const handleFieldChange = (
    field: keyof ParsedInvoice,
    value: string | number
  ) => {
    const updated = { ...editedInvoice, [field]: value };
    setEditedInvoice(recalculateTotals(updated));
  };

  const current = isEditing ? editedInvoice : invoice;
  const { issueDate, dueDate } = getInvoiceDates(current);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden w-full">
      {/* ── Header ── */}
      <div
        className="px-5 py-5 border-b border-gray-200"
        style={{
          background:
            "linear-gradient(135deg, #FAFAFA 0%, #F5F5F5 50%, #F8F8F8 100%)",
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Invoice Preview
          </p>
          {invoiceNumber && (
            <Badge
              variant="outline"
              className="text-xs font-bold text-gray-600 border-gray-200"
            >
              {invoiceNumber}
            </Badge>
          )}
        </div>

        {/* 2×2 metadata grid */}
        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-gray-400 text-xs">Issue Date</p>
              <p className="text-gray-700 text-xs font-semibold">{issueDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-gray-400 text-xs">Due Date</p>
              <p className="text-gray-700 text-xs font-semibold">{dueDate}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Fields ── */}
      <div className="p-5 space-y-5">
        {/* Client Name — edit mode only */}
        {isEditing && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Client Name
            </Label>
            <Input
              value={current.clientName}
              onChange={(e) => handleFieldChange("clientName", e.target.value)}
              className="rounded-xl text-sm focus-visible:ring-indigo-400"
            />
          </div>
        )}

        {/* Services table */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Services
          </p>

          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 mb-1">
            <div className="col-span-5">
              <p className="text-xs font-semibold text-gray-400">Description</p>
            </div>
            <div className="col-span-4 text-center">
              <p className="text-xs font-semibold text-gray-400">Qty × Rate</p>
            </div>
            <div className="col-span-3 text-right">
              <p className="text-xs font-semibold text-gray-400">Amount</p>
            </div>
          </div>

          <div className="space-y-0">
            {current.lineItems?.map((item, index) =>
              isEditing ? (
                <div
                  key={index}
                  className="bg-gray-50 rounded-xl p-3 space-y-2 mb-2"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={item.description}
                      onChange={(e) =>
                        handleLineItemChange(
                          index,
                          "description",
                          e.target.value
                        )
                      }
                      placeholder="Description"
                      className="flex-1 rounded-lg text-sm focus-visible:ring-indigo-400"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveLineItem(index)}
                      className="w-8 h-8 text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        handleLineItemChange(index, "quantity", e.target.value)
                      }
                      placeholder="Qty"
                      className="rounded-lg text-sm focus-visible:ring-indigo-400"
                    />
                    <Input
                      value={item.unit}
                      onChange={(e) =>
                        handleLineItemChange(index, "unit", e.target.value)
                      }
                      placeholder="Unit"
                      className="rounded-lg text-sm focus-visible:ring-indigo-400"
                    />
                    <Input
                      type="number"
                      value={item.rate}
                      onChange={(e) =>
                        handleLineItemChange(index, "rate", e.target.value)
                      }
                      placeholder="Rate"
                      className="rounded-lg text-sm focus-visible:ring-indigo-400"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>
                      {item.quantity} {item.unit} × ₹
                      {item.rate.toLocaleString("en-IN")}
                    </span>
                    <span className="font-semibold text-gray-800">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0"
                >
                  <div className="col-span-5">
                    <p className="text-sm font-medium text-gray-800">
                      {item.description}
                    </p>
                  </div>
                  <div className="col-span-4 text-center">
                    <p className="text-xs text-gray-500">
                      {item.quantity} {item.unit}
                    </p>
                    <p className="text-xs text-gray-400">
                      × {formatCurrency(item.rate)}
                    </p>
                  </div>
                  <div className="col-span-3 text-right">
                    <p className="text-sm font-medium text-gray-800">
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>

          {isEditing && (
            <Button
              variant="outline"
              onClick={handleAddLineItem}
              className="w-full mt-2 border-dashed rounded-xl text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-500 h-9"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add line item
            </Button>
          )}
        </div>

        {/* GST + Terms — edit mode only */}
        {isEditing && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                GST %
              </Label>
              <Input
                type="number"
                value={current.gstPercent}
                onChange={(e) =>
                  handleFieldChange(
                    "gstPercent",
                    parseFloat(e.target.value) || 0
                  )
                }
                className="rounded-xl text-sm focus-visible:ring-indigo-400"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Payment Terms
              </Label>
              <Input
                type="number"
                value={current.paymentTermsDays}
                onChange={(e) =>
                  handleFieldChange(
                    "paymentTermsDays",
                    parseInt(e.target.value) || 15
                  )
                }
                className="rounded-xl text-sm focus-visible:ring-indigo-400"
              />
            </div>
          </div>
        )}

        {/* ── Totals ── */}
        <div className="rounded-xl overflow-hidden border border-gray-100">
          <div className="flex justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <span className="text-xs text-gray-500">Subtotal</span>
            <span className="text-xs font-medium text-gray-700">
              {formatCurrency(current.subtotal)}
            </span>
          </div>
          <div className="flex justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <span className="text-xs text-gray-500">
              GST ({current.gstPercent}%)
            </span>
            <span className="text-xs font-medium text-gray-700">
              {formatCurrency(current.gstAmount)}
            </span>
          </div>
          <div className="flex justify-between px-4 py-3 bg-white border-t border-gray-200">
            <span className="text-sm font-bold text-gray-800">Total Due</span>
            <span className="text-base font-bold text-gray-900">
              {formatCurrency(current.total)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="px-5 pb-5 flex items-center gap-2">
        {isEditing ? (
          <>
            <Button
              onClick={() => {
                setIsEditing(false);
                onEdit(editedInvoice);
              }}
              className="flex-1 rounded-xl gap-2 bg-gray-900 hover:bg-black"
            >
              <Check className="w-4 h-4" />
              Save Changes
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditing(false);
                setEditedInvoice(invoice);
              }}
              className="rounded-xl"
            >
              Cancel
            </Button>
          </>
        ) : isConfirmed ? (
          <div className="w-full flex items-center gap-2">
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl flex-1 border border-emerald-100">
              <Check className="w-4 h-4" />
              <span className="text-sm font-medium">
                Saved as {invoiceNumber}
              </span>
            </div>
            {invoiceNumber && (
              <DownloadPDFButton
                invoice={current}
                invoiceNumber={invoiceNumber}
                userName={userName}
              />
            )}
          </div>
        ) : (
          <>
            <Button
              onClick={() => onConfirm(current)}
              className="flex-1 rounded-xl gap-2 bg-gray-900 hover:bg-black"
              style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
            >
              <Check className="w-4 h-4" />
              Confirm Invoice
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsEditing(true)}
              className="rounded-xl"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
