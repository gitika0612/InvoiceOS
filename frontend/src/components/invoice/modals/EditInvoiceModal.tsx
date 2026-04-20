import { useState } from "react";
import { X, Lock, Save, Loader2, Plus, Trash2 } from "lucide-react";
import { LineItem } from "../InvoicePreviewCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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
    <Dialog open={true} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 rounded-2xl overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-gray-100 space-y-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold text-gray-900">
                Edit Invoice
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-400 mt-0.5">
                {invoice.invoiceNumber} ·{" "}
                {isDraft
                  ? "All fields editable"
                  : isSentOrOverdue
                  ? "Only due date and status editable"
                  : "Locked"}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="w-8 h-8 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Body */}
        <ScrollArea className="max-h-[60vh]">
          <div className="px-6 py-5 space-y-4">
            {/* Status banner */}
            {isSentOrOverdue && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  This invoice has been <strong>{invoice.status}</strong>.
                  Amount fields are locked.
                </p>
              </div>
            )}

            {/* Client Name */}
            <FieldWrapper label="Client Name" locked={!isDraft}>
              {isDraft ? (
                <Input
                  value={form.clientName}
                  onChange={(e) => handleChange("clientName", e.target.value)}
                  className="rounded-xl text-sm focus-visible:ring-indigo-400"
                />
              ) : (
                <LockedValue value={form.clientName} />
              )}
            </FieldWrapper>

            {/* Line Items */}
            <FieldWrapper label="Line Items" locked={!isDraft}>
              <div className="space-y-2">
                {form.lineItems.map((item, index) =>
                  isDraft ? (
                    <div
                      key={index}
                      className="bg-gray-50 rounded-xl p-3 space-y-2"
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
                            handleLineItemChange(
                              index,
                              "quantity",
                              e.target.value
                            )
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
                  <Button
                    variant="outline"
                    onClick={handleAddLineItem}
                    className="w-full border-dashed rounded-xl text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-500 h-9"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add line item
                  </Button>
                )}
              </div>
            </FieldWrapper>

            {/* GST + Payment Terms */}
            <div className="grid grid-cols-2 gap-3">
              <FieldWrapper label="GST %" locked={!isDraft}>
                {isDraft ? (
                  <Input
                    type="number"
                    value={form.gstPercent}
                    onChange={(e) =>
                      handleChange(
                        "gstPercent",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="rounded-xl text-sm focus-visible:ring-indigo-400"
                  />
                ) : (
                  <LockedValue value={`${form.gstPercent}%`} />
                )}
              </FieldWrapper>
              <FieldWrapper label="Payment Terms" locked={false}>
                <Input
                  type="number"
                  value={form.paymentTermsDays}
                  onChange={(e) =>
                    handleChange(
                      "paymentTermsDays",
                      parseInt(e.target.value) || 15
                    )
                  }
                  className="rounded-xl text-sm focus-visible:ring-indigo-400"
                />
              </FieldWrapper>
            </div>

            {/* Totals */}
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
              <Separator className="my-1" />
              <div className="flex justify-between text-sm font-bold">
                <span className="text-gray-900">Total</span>
                <span className="text-indigo-600">{formatINR(form.total)}</span>
              </div>
            </div>

            {/* Due Date */}
            <FieldWrapper label="Due Date" locked={false}>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => handleChange("dueDate", e.target.value)}
                className="rounded-xl text-sm focus-visible:ring-indigo-400"
              />
            </FieldWrapper>

            {/* Status */}
            <FieldWrapper label="Status" locked={false}>
              <Select
                value={form.status}
                onValueChange={(val) => handleChange("status", val)}
              >
                <SelectTrigger className="rounded-xl text-sm focus:ring-indigo-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isDraft && <SelectItem value="draft">Draft</SelectItem>}
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </FieldWrapper>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 rounded-xl font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 gap-2"
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
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldWrapper({
  label,
  locked,
  children,
}: {
  label: string;
  locked: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </Label>
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
