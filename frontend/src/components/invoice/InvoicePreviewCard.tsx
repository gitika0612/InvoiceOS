import { useState } from "react";
import { Check, Edit2, X, Plus, Trash2 } from "lucide-react";
import { DownloadPDFButton } from "./DownloadPDFButton";

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
  // Legacy fields for backward compatibility
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

export function InvoicePreviewCard({
  invoice,
  onConfirm,
  onEdit,
  onDiscard,
  isConfirmed = false,
  invoiceNumber,
  userName,
}: InvoicePreviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedInvoice, setEditedInvoice] = useState(invoice);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

  // Recalculate totals from line items
  const recalculateTotals = (updated: ParsedInvoice): ParsedInvoice => {
    const subtotal = updated.lineItems.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    const gstAmount = Math.round((subtotal * updated.gstPercent) / 100);
    const total = subtotal + gstAmount;
    return { ...updated, subtotal, gstAmount, total };
  };

  // Update a single line item field
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
      // Recalculate item amount
      updated.amount = Math.round(
        Number(updated.quantity) * Number(updated.rate)
      );
      return updated;
    });
    setEditedInvoice(
      recalculateTotals({ ...editedInvoice, lineItems: updatedItems })
    );
  };

  // Add new empty line item
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

  // Remove a line item
  const handleRemoveLineItem = (index: number) => {
    const updatedItems = editedInvoice.lineItems.filter((_, i) => i !== index);
    setEditedInvoice(
      recalculateTotals({ ...editedInvoice, lineItems: updatedItems })
    );
  };

  // Update top level fields
  const handleFieldChange = (
    field: keyof ParsedInvoice,
    value: string | number
  ) => {
    const updated = { ...editedInvoice, [field]: value };
    setEditedInvoice(recalculateTotals(updated));
  };

  const current = isEditing ? editedInvoice : invoice;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-card overflow-hidden w-full max-w-md">
      {/* Header */}
      <div
        className="px-5 py-4 border-b border-gray-100 flex items-center justify-between"
        style={{
          background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
        }}
      >
        <div>
          <p className="text-xs font-medium text-indigo-200 uppercase tracking-wide">
            Invoice Preview
          </p>
          <p className="text-white font-bold text-lg mt-0.5">
            {current.clientName}
          </p>
        </div>
        <button
          onClick={onDiscard}
          className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Fields */}
      <div className="p-5 space-y-4">
        {/* Client Name */}
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
            Client Name
          </p>
          {isEditing ? (
            <input
              value={current.clientName}
              onChange={(e) => handleFieldChange("clientName", e.target.value)}
              className={inputClass}
            />
          ) : (
            <p className="text-sm font-medium text-gray-900">
              {current.clientName}
            </p>
          )}
        </div>

        {/* Line Items */}
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Line Items
          </p>
          <div className="space-y-2">
            {current.lineItems?.map((item, index) =>
              isEditing ? (
                <div
                  key={index}
                  className="bg-gray-50 rounded-xl p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={item.description}
                      onChange={(e) =>
                        handleLineItemChange(
                          index,
                          "description",
                          e.target.value
                        )
                      }
                      placeholder="Description"
                      className={inputClass + " flex-1"}
                    />
                    <button
                      onClick={() => handleRemoveLineItem(index)}
                      className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        handleLineItemChange(index, "quantity", e.target.value)
                      }
                      placeholder="Qty"
                      className={inputClass}
                    />
                    <input
                      value={item.unit}
                      onChange={(e) =>
                        handleLineItemChange(index, "unit", e.target.value)
                      }
                      placeholder="Unit"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) =>
                        handleLineItemChange(index, "rate", e.target.value)
                      }
                      placeholder="Rate"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>
                      {item.quantity} {item.unit} × ₹
                      {item.rate.toLocaleString("en-IN")}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {item.description}
                    </p>
                    <p className="text-xs text-gray-400">
                      {item.quantity} {item.unit} × {formatCurrency(item.rate)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(item.amount)}
                  </p>
                </div>
              )
            )}

            {/* Add line item button — only in edit mode */}
            {isEditing && (
              <button
                onClick={handleAddLineItem}
                className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add line item
              </button>
            )}
          </div>
        </div>

        {/* GST + Payment Terms */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
              GST %
            </p>
            {isEditing ? (
              <input
                type="number"
                value={current.gstPercent}
                onChange={(e) =>
                  handleFieldChange(
                    "gstPercent",
                    parseFloat(e.target.value) || 0
                  )
                }
                className={inputClass}
              />
            ) : (
              <p className="text-sm font-medium text-gray-900">
                {current.gstPercent}%
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
              Payment Terms
            </p>
            {isEditing ? (
              <input
                type="number"
                value={current.paymentTermsDays}
                onChange={(e) =>
                  handleFieldChange(
                    "paymentTermsDays",
                    parseInt(e.target.value) || 15
                  )
                }
                className={inputClass}
              />
            ) : (
              <p className="text-sm font-medium text-gray-900">
                {current.paymentTermsDays} days
              </p>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="border-t border-gray-100 pt-3 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-700 font-medium">
              {formatCurrency(current.subtotal)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">GST ({current.gstPercent}%)</span>
            <span className="text-gray-700 font-medium">
              {formatCurrency(current.gstAmount)}
            </span>
          </div>
          <div className="flex justify-between text-base font-bold border-t border-gray-100 pt-2 mt-1">
            <span className="text-gray-900">Total</span>
            <span className="text-indigo-600">
              {formatCurrency(current.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 flex items-center gap-2">
        {isEditing ? (
          <>
            <button
              onClick={() => {
                setIsEditing(false);
                onEdit(editedInvoice);
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              <Check className="w-4 h-4" />
              Save Changes
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditedInvoice(invoice);
              }}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : isConfirmed ? (
          <div className="w-full flex items-center gap-2">
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl flex-1">
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
            <button
              onClick={() => onConfirm(current)}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
              style={{ boxShadow: "0 4px 12px rgba(79,70,229,0.3)" }}
            >
              <Check className="w-4 h-4" />
              Confirm Invoice
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white";
