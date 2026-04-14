import { useState } from "react";
import { X, Lock, Save, Loader2, Plus, Trash2 } from "lucide-react";
import { LineItem } from "./InvoicePreviewCard";

interface EditInvoiceData {
  _id: string;
  invoiceNumber: string;
  clientName: string;
  lineItems?: LineItem[];
  paymentTermsDays?: number;
  gstPercent: number;
  subtotal: number;
  gstAmount: number;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue";
  dueDate: string;
}

interface EditInvoiceModalProps {
  invoice: EditInvoiceData;
  onSave: (id: string, data: Partial<EditInvoiceData>) => Promise<void>;
  onClose: () => void;
}

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function EditInvoiceModal({
  invoice,
  onSave,
  onClose,
}: EditInvoiceModalProps) {
  const isDraft = invoice.status === "draft";
  const isSentOrOverdue =
    invoice.status === "sent" || invoice.status === "overdue";

  const [form, setForm] = useState({
    clientName: invoice.clientName,
    lineItems: invoice.lineItems || [],
    paymentTermsDays: invoice.paymentTermsDays || 15,
    gstPercent: invoice.gstPercent,
    subtotal: invoice.subtotal,
    gstAmount: invoice.gstAmount,
    total: invoice.total,
    dueDate: invoice.dueDate
      ? new Date(invoice.dueDate).toISOString().split("T")[0]
      : "",
    status: invoice.status,
  });
  const [saving, setSaving] = useState(false);

  // Recalculate totals whenever lineItems or gstPercent changes
  const recalculate = (items: LineItem[], gstPercent: number) => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const gstAmount = Math.round((subtotal * gstPercent) / 100);
    const total = subtotal + gstAmount;
    return { subtotal, gstAmount, total };
  };

  const handleLineItemChange = (
    index: number,
    field: keyof LineItem,
    value: string | number
  ) => {
    const updatedItems = form.lineItems.map((item, i) => {
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
    setForm({
      ...form,
      lineItems: updatedItems,
      ...recalculate(updatedItems, form.gstPercent),
    });
  };

  const handleAddLineItem = () => {
    const newItem: LineItem = {
      description: "",
      quantity: 1,
      unit: "item",
      rate: 0,
      amount: 0,
    };
    const updatedItems = [...form.lineItems, newItem];
    setForm({
      ...form,
      lineItems: updatedItems,
      ...recalculate(updatedItems, form.gstPercent),
    });
  };

  const handleRemoveLineItem = (index: number) => {
    const updatedItems = form.lineItems.filter((_, i) => i !== index);
    setForm({
      ...form,
      lineItems: updatedItems,
      ...recalculate(updatedItems, form.gstPercent),
    });
  };

  const handleChange = (field: keyof typeof form, value: string | number) => {
    const updated = { ...form, [field]: value };
    if (field === "gstPercent") {
      setForm({ ...updated, ...recalculate(updated.lineItems, Number(value)) });
    } else {
      setForm(updated);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(invoice._id, form);
      onClose();
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">Edit Invoice</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {invoice.invoiceNumber} ·{" "}
              {isDraft
                ? "All fields editable"
                : isSentOrOverdue
                ? "Only due date and status editable"
                : "Locked"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Status banner */}
          {isSentOrOverdue && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                This invoice has been <strong>{invoice.status}</strong>. Amount
                fields are locked.
              </p>
            </div>
          )}

          {/* Client Name */}
          <Field label="Client Name" locked={!isDraft}>
            {isDraft ? (
              <input
                value={form.clientName}
                onChange={(e) => handleChange("clientName", e.target.value)}
                className={inputClass}
              />
            ) : (
              <LockedValue value={form.clientName} />
            )}
          </Field>

          {/* Line Items */}
          <Field label="Line Items" locked={!isDraft}>
            <div className="space-y-2">
              {form.lineItems.map((item, index) =>
                isDraft ? (
                  <div
                    key={index}
                    className="bg-gray-50 rounded-xl p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
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
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          handleLineItemChange(
                            index,
                            "quantity",
                            e.target.value
                          )
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
                        {formatINR(item.amount)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    key={index}
                    className="flex justify-between bg-gray-50 rounded-xl px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm text-gray-700">
                        {item.description}
                      </p>
                      <p className="text-xs text-gray-400">
                        {item.quantity} {item.unit} × ₹
                        {item.rate.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatINR(item.amount)}
                    </p>
                  </div>
                )
              )}

              {isDraft && (
                <button
                  onClick={handleAddLineItem}
                  className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add line item
                </button>
              )}
            </div>
          </Field>

          {/* GST + Payment Terms */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="GST %" locked={!isDraft}>
              {isDraft ? (
                <input
                  type="number"
                  value={form.gstPercent}
                  onChange={(e) =>
                    handleChange("gstPercent", parseFloat(e.target.value) || 0)
                  }
                  className={inputClass}
                />
              ) : (
                <LockedValue value={`${form.gstPercent}%`} />
              )}
            </Field>
            <Field label="Payment Terms" locked={false}>
              <input
                type="number"
                value={form.paymentTermsDays}
                onChange={(e) =>
                  handleChange(
                    "paymentTermsDays",
                    parseInt(e.target.value) || 15
                  )
                }
                className={inputClass}
              />
            </Field>
          </div>

          {/* Totals — always locked */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-700">
                {formatINR(form.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">GST ({form.gstPercent}%)</span>
              <span className="font-medium text-gray-700">
                {formatINR(form.gstAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2">
              <span className="text-gray-900">Total</span>
              <span className="text-indigo-600">{formatINR(form.total)}</span>
            </div>
          </div>

          {/* Due Date */}
          <Field label="Due Date" locked={false}>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => handleChange("dueDate", e.target.value)}
              className={inputClass}
            />
          </Field>

          {/* Status */}
          <Field label="Status" locked={false}>
            <select
              value={form.status}
              onChange={(e) => handleChange("status", e.target.value)}
              className={inputClass}
            >
              {isDraft && <option value="draft">Draft</option>}
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </Field>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors"
            style={{ background: "#4F46E5" }}
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full text-sm text-gray-900 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 transition-all bg-white";

function Field({
  label,
  locked,
  children,
}: {
  label: string;
  locked: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </p>
        {locked && <Lock className="w-3 h-3 text-gray-300" />}
      </div>
      {children}
    </div>
  );
}

function LockedValue({ value }: { value: string }) {
  return (
    <div className="w-full text-sm text-gray-400 border border-gray-100 rounded-xl px-3 py-2 bg-gray-50">
      {value}
    </div>
  );
}
