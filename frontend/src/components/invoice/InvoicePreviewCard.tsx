import { useState, useEffect, useMemo } from "react";
import {
  Check,
  Edit2,
  Plus,
  Send,
  Trash2,
  Zap,
  AlertCircle,
} from "lucide-react";
import { DownloadPDFButton } from "./pdf/DownloadPDFButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, UserProfile } from "@/hooks/useAuth";
import { getClientByName, upsertClient, ClientAPI } from "@/lib/api/clientApi";
import { useUser } from "@clerk/clerk-react";
import { updateInvoice } from "@/lib/api/invoiceApi";

export interface LineItem {
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  hsnSacCode?: string;
  hsnSacType?: "HSN" | "SAC";
}

export interface ParsedInvoice {
  clientName: string;
  lineItems: LineItem[];
  gstPercent: number;
  gstType?: "IGST" | "CGST_SGST";
  cgstPercent?: number;
  sgstPercent?: number;
  igstPercent?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  gstAmount: number;
  discountType?: "percent" | "amount" | "none";
  discountValue?: number;
  discountAmount?: number;
  placeOfSupply?: string;
  notes?: string;
  subtotal: number;
  taxableAmount?: number;
  total: number;
  paymentTermsDays: number;
  invoiceDate?: string;
  invoiceMonth?: string;
}

interface InvoicePreviewCardProps {
  invoice: ParsedInvoice;
  onConfirm: (invoice: ParsedInvoice) => void;
  onEdit: (invoice: ParsedInvoice) => void;
  onDiscard: () => void;
  isConfirmed?: boolean;
  invoiceNumber?: string;
  invoiceId?: string;
  userName?: string;
}

interface ValidationErrors {
  clientName?: string;
  email?: string;
  gstPercent?: string;
  paymentTermsDays?: string;
  lineItems?: string;
  lineItemErrors?: { description?: string; quantity?: string; rate?: string }[];
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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-1 mt-1">
      <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
      <p className="text-xs text-red-500">{message}</p>
    </div>
  );
}

// ── Recalculate all totals including discount + GST split ──
function recalculateInvoiceTotals(invoice: ParsedInvoice): ParsedInvoice {
  const subtotal = invoice.lineItems.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  const discountType = invoice.discountType || "none";
  const discountValue = invoice.discountValue || 0;
  const discountAmount =
    discountType === "percent"
      ? Math.round((subtotal * discountValue) / 100)
      : discountType === "amount"
      ? discountValue
      : 0;

  const taxableAmount = subtotal - discountAmount;
  const gstAmount = Math.round((taxableAmount * invoice.gstPercent) / 100);
  const gstType = invoice.gstType || "CGST_SGST";

  const cgstAmount = gstType === "CGST_SGST" ? Math.round(gstAmount / 2) : 0;
  const sgstAmount = gstType === "CGST_SGST" ? gstAmount - cgstAmount : 0;
  const igstAmount = gstType === "IGST" ? gstAmount : 0;

  const cgstPercent = gstType === "CGST_SGST" ? invoice.gstPercent / 2 : 0;
  const sgstPercent = gstType === "CGST_SGST" ? invoice.gstPercent / 2 : 0;
  const igstPercent = gstType === "IGST" ? invoice.gstPercent : 0;

  return {
    ...invoice,
    subtotal,
    discountAmount,
    taxableAmount,
    gstAmount,
    gstType,
    cgstPercent,
    sgstPercent,
    igstPercent,
    cgstAmount,
    sgstAmount,
    igstAmount,
    total: taxableAmount + gstAmount,
  };
}

export function InvoicePreviewCard({
  invoice,
  onConfirm,
  onEdit,
  onDiscard,
  isConfirmed = false,
  invoiceNumber,
  invoiceId,
  userName,
}: InvoicePreviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedInvoice, setEditedInvoice] = useState(invoice);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [client, setClient] = useState<ClientAPI | null>(null);
  const [editedClientName, setEditedClientName] = useState("");
  const [editedClientEmail, setEditedClientEmail] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const { getUserProfile } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    getUserProfile().then(setProfile);
  }, []);

  useEffect(() => {
    if (!user || !invoice.clientName) return;
    getClientByName(user.id, invoice.clientName).then((c) => {
      setClient(c);
      setEditedClientName(c?.name || invoice.clientName);
      setEditedClientEmail(c?.email || "");
    });
  }, [invoice.clientName, user?.id]);

  const errors = useMemo((): ValidationErrors => {
    const errs: ValidationErrors = {};
    if (!editedClientName.trim() || editedClientName.trim().length < 2)
      errs.clientName = "Client name must be at least 2 characters";
    if (editedClientEmail && !isValidEmail(editedClientEmail))
      errs.email = "Enter a valid email address";
    const gst = Number(editedInvoice.gstPercent);
    if (isNaN(gst) || gst < 0 || gst > 100)
      errs.gstPercent = "GST must be between 0 and 100";
    const terms = Number(editedInvoice.paymentTermsDays);
    if (isNaN(terms) || terms < 1 || terms > 365)
      errs.paymentTermsDays = "Payment terms must be 1–365 days";
    if (editedInvoice.lineItems.length === 0)
      errs.lineItems = "At least one line item is required";
    const lineItemErrors = editedInvoice.lineItems.map((item) => {
      const itemErrs: {
        description?: string;
        quantity?: string;
        rate?: string;
      } = {};
      if (!String(item.description ?? "").trim())
        itemErrs.description = "Description required";
      if (item.quantity <= 0) itemErrs.quantity = "Must be > 0";
      if (item.rate <= 0) itemErrs.rate = "Must be > 0";
      return itemErrs;
    });
    if (lineItemErrors.some((e) => e.description || e.quantity || e.rate))
      errs.lineItemErrors = lineItemErrors;
    return errs;
  }, [editedClientName, editedClientEmail, editedInvoice]);

  const isValid = useMemo(
    () =>
      !errors.clientName &&
      !errors.email &&
      !errors.gstPercent &&
      !errors.paymentTermsDays &&
      !errors.lineItems &&
      !errors.lineItemErrors,
    [errors]
  );

  const markTouched = (field: string) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const handleLineItemChange = (
    index: number,
    field: keyof LineItem,
    value: string | number
  ) => {
    markTouched(`item_${index}_${field}`);
    const items = editedInvoice.lineItems.map((item, i) => {
      if (i !== index) return item;
      const updated = {
        ...item,
        [field]:
          field === "description"
            ? value
            : typeof value === "string" && value !== "" && !isNaN(Number(value))
            ? Number(value)
            : value,
      };
      updated.amount = Math.round(
        Number(updated.quantity) * Number(updated.rate)
      );
      return updated;
    });
    setEditedInvoice(
      recalculateInvoiceTotals({ ...editedInvoice, lineItems: items })
    );
  };

  const handleFieldChange = (
    field: keyof ParsedInvoice,
    value: string | number | boolean | LineItem[]
  ) => {
    setEditedInvoice(
      recalculateInvoiceTotals({ ...editedInvoice, [field]: value })
    );
  };

  const handleSaveChanges = async () => {
    if (!isValid) return;
    setIsEditing(false);
    setTouched({});

    const finalInvoice = recalculateInvoiceTotals({
      ...editedInvoice,
      clientName: editedClientName || editedInvoice.clientName,
    });

    if (invoiceId) {
      try {
        await updateInvoice(invoiceId, finalInvoice);
      } catch (err) {
        console.error("Failed to update invoice in DB:", err);
      }
    }

    onEdit(finalInvoice);

    if (user && editedClientEmail) {
      try {
        const updated = await upsertClient(user.id, {
          name: editedClientName || editedInvoice.clientName,
          email: editedClientEmail,
          city: client?.city || "",
          state: client?.state || "",
          phone: client?.phone || "",
          address: client?.address || "",
          pincode: client?.pincode || "",
          gstin: client?.gstin || "",
        });
        setClient(updated);
      } catch (err) {
        console.error("Failed to update client:", err);
      }
    }
  };

  const current = isEditing ? editedInvoice : invoice;
  const { issueDate, dueDate } = getInvoiceDates(current);
  const senderName = profile?.businessName || userName || "Your Business";
  const displayClientName = isEditing
    ? editedClientName
    : client?.name || current.clientName;
  const displayClientEmail = isEditing ? editedClientEmail : client?.email;
  const clientAddress = client?.address;
  const clientLocationLine = [client?.city, client?.state]
    .filter(Boolean)
    .join(", ");
  const clientPincode = client?.pincode;

  const showCgstSgst = (current.gstType || "CGST_SGST") === "CGST_SGST";
  const hasDiscount =
    current.discountType &&
    current.discountType !== "none" &&
    (current.discountValue || 0) > 0;

  return (
    <div className="bg-white rounded-2xl overflow-hidden w-full border border-gray-100 shadow-sm">
      {/* ── EDIT MODE ── */}
      {isEditing && (
        <div className="p-4 border-b border-gray-100 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Client name */}
            <div className="col-span-2">
              <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
                Client Name
              </Label>
              <Input
                value={editedClientName}
                onChange={(e) => {
                  setEditedClientName(e.target.value);
                  handleFieldChange("clientName", e.target.value);
                }}
                onBlur={() => markTouched("clientName")}
                className={`rounded-xl text-sm focus-visible:ring-indigo-400 ${
                  touched.clientName && errors.clientName
                    ? "border-red-300"
                    : ""
                }`}
              />
              {touched.clientName && <FieldError message={errors.clientName} />}
            </div>

            {/* Client email */}
            <div>
              <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
                Client Email
              </Label>
              <Input
                value={editedClientEmail}
                onChange={(e) => setEditedClientEmail(e.target.value)}
                onBlur={() => markTouched("email")}
                placeholder="client@email.com"
                className={`rounded-xl text-sm focus-visible:ring-indigo-400 ${
                  touched.email && errors.email ? "border-red-300" : ""
                }`}
              />
              {touched.email && <FieldError message={errors.email} />}
            </div>

            {/* GST % */}
            <div>
              <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
                GST %
              </Label>
              <Input
                type="number"
                value={current.gstPercent === 0 ? "" : current.gstPercent}
                onChange={(e) =>
                  handleFieldChange(
                    "gstPercent",
                    e.target.value === "" ? 0 : Number(e.target.value)
                  )
                }
                onBlur={() => markTouched("gstPercent")}
                className={`rounded-xl text-sm focus-visible:ring-indigo-400 ${
                  touched.gstPercent && errors.gstPercent
                    ? "border-red-300"
                    : ""
                }`}
              />
              {touched.gstPercent && <FieldError message={errors.gstPercent} />}
            </div>

            {/* GST Type */}
            <div>
              <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
                GST Type
              </Label>
              <div className="flex gap-2">
                {(["CGST_SGST", "IGST"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleFieldChange("gstType", type)}
                    className={`flex-1 h-9 rounded-xl text-xs font-semibold border transition-all ${
                      (current.gstType || "CGST_SGST") === type
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {type === "CGST_SGST" ? "CGST + SGST" : "IGST"}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment terms */}
            <div>
              <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
                Payment Terms (days)
              </Label>
              <Input
                type="number"
                value={
                  current.paymentTermsDays === 0 ? "" : current.paymentTermsDays
                }
                onChange={(e) =>
                  handleFieldChange(
                    "paymentTermsDays",
                    e.target.value === "" ? 0 : Number(e.target.value)
                  )
                }
                onBlur={() => markTouched("paymentTermsDays")}
                className={`rounded-xl text-sm focus-visible:ring-indigo-400 ${
                  touched.paymentTermsDays && errors.paymentTermsDays
                    ? "border-red-300"
                    : ""
                }`}
              />
              {touched.paymentTermsDays && (
                <FieldError message={errors.paymentTermsDays} />
              )}
            </div>

            {/* Place of supply */}
            <div>
              <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
                Place of Supply
              </Label>
              <Input
                value={current.placeOfSupply || ""}
                onChange={(e) =>
                  handleFieldChange("placeOfSupply", e.target.value)
                }
                placeholder="e.g. Haryana"
                className="rounded-xl text-sm focus-visible:ring-indigo-400"
              />
            </div>

            {/* Discount */}
            <div className="col-span-2">
              <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
                Discount
              </Label>
              <div className="flex gap-2">
                {(["none", "percent", "amount"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleFieldChange("discountType", type)}
                    className={`px-3 h-9 rounded-xl text-xs font-semibold border transition-all ${
                      (current.discountType || "none") === type
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {type === "none"
                      ? "No discount"
                      : type === "percent"
                      ? "%"
                      : "₹ Fixed"}
                  </button>
                ))}
                {current.discountType && current.discountType !== "none" && (
                  <Input
                    type="number"
                    value={current.discountValue || ""}
                    onChange={(e) =>
                      handleFieldChange("discountValue", Number(e.target.value))
                    }
                    placeholder={
                      current.discountType === "percent" ? "10" : "5000"
                    }
                    className="flex-1 rounded-xl text-sm h-9 focus-visible:ring-indigo-400"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Line Items
              </Label>
              {errors.lineItems && (
                <span className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.lineItems}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {editedInvoice.lineItems.map((item, index) => {
                const itemErr = errors.lineItemErrors?.[index];
                const iDescTouched = touched[`item_${index}_description`];
                const iQtyTouched = touched[`item_${index}_quantity`];
                const iRateTouched = touched[`item_${index}_rate`];
                return (
                  <div
                    key={index}
                    className={`bg-gray-50 rounded-xl p-3 border ${
                      itemErr && (iDescTouched || iQtyTouched || iRateTouched)
                        ? "border-red-100"
                        : "border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1">
                        <Input
                          value={String(item.description ?? "")}
                          onChange={(e) =>
                            handleLineItemChange(
                              index,
                              "description",
                              e.target.value
                            )
                          }
                          onBlur={() =>
                            markTouched(`item_${index}_description`)
                          }
                          placeholder="Service description"
                          className={`rounded-lg text-sm bg-white focus-visible:ring-indigo-400 ${
                            iDescTouched && itemErr?.description
                              ? "border-red-300"
                              : ""
                          }`}
                        />
                        {iDescTouched && (
                          <FieldError message={itemErr?.description} />
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const items = editedInvoice.lineItems.filter(
                            (_, i) => i !== index
                          );
                          setEditedInvoice(
                            recalculateInvoiceTotals({
                              ...editedInvoice,
                              lineItems: items,
                            })
                          );
                        }}
                        className="w-8 h-8 text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* HSN/SAC code */}
                    <div className="flex gap-2 mb-2">
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 mb-1">
                          HSN/SAC Code
                        </p>
                        <div className="flex gap-1">
                          <Input
                            value={item.hsnSacCode || ""}
                            onChange={(e) =>
                              handleLineItemChange(
                                index,
                                "hsnSacCode",
                                e.target.value
                              )
                            }
                            placeholder="e.g. 998314"
                            className="rounded-lg text-xs bg-white focus-visible:ring-indigo-400 h-8"
                          />
                          <div className="flex gap-1">
                            {(["HSN", "SAC"] as const).map((type) => (
                              <button
                                key={type}
                                onClick={() =>
                                  handleLineItemChange(
                                    index,
                                    "hsnSacType",
                                    type
                                  )
                                }
                                className={`px-2 h-8 rounded-lg text-[10px] font-bold border transition-all ${
                                  (item.hsnSacType || "SAC") === type
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                    : "bg-gray-50 border-gray-200 text-gray-400"
                                }`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Quantity</p>
                        <Input
                          type="number"
                          value={item.quantity === 0 ? "" : item.quantity}
                          onChange={(e) =>
                            handleLineItemChange(
                              index,
                              "quantity",
                              e.target.value === "" ? 0 : Number(e.target.value)
                            )
                          }
                          onBlur={() => markTouched(`item_${index}_quantity`)}
                          className={`rounded-lg text-sm bg-white focus-visible:ring-indigo-400 h-8 ${
                            iQtyTouched && itemErr?.quantity
                              ? "border-red-300"
                              : ""
                          }`}
                        />
                        {iQtyTouched && (
                          <FieldError message={itemErr?.quantity} />
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Rate (₹)</p>
                        <Input
                          type="number"
                          value={item.rate === 0 ? "" : item.rate}
                          onChange={(e) =>
                            handleLineItemChange(
                              index,
                              "rate",
                              e.target.value === "" ? 0 : Number(e.target.value)
                            )
                          }
                          onBlur={() => markTouched(`item_${index}_rate`)}
                          className={`rounded-lg text-sm bg-white focus-visible:ring-indigo-400 h-8 ${
                            iRateTouched && itemErr?.rate
                              ? "border-red-300"
                              : ""
                          }`}
                        />
                        {iRateTouched && <FieldError message={itemErr?.rate} />}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Amount</p>
                        <div className="h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center px-3">
                          <span className="text-sm font-semibold text-indigo-700">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button
              variant="outline"
              onClick={() =>
                setEditedInvoice({
                  ...editedInvoice,
                  lineItems: [
                    ...editedInvoice.lineItems,
                    {
                      description: "",
                      quantity: 1,
                      unit: "item",
                      rate: 0,
                      amount: 0,
                      hsnSacCode: "",
                      hsnSacType: "SAC",
                    },
                  ],
                })
              }
              className="w-full mt-2 border-dashed rounded-xl text-xs text-gray-500 hover:border-indigo-400 hover:text-indigo-500 h-9"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add line item
            </Button>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
              Notes
            </Label>
            <textarea
              value={current.notes || ""}
              onChange={(e) => handleFieldChange("notes", e.target.value)}
              placeholder="Payment instructions, bank details, late payment terms..."
              rows={3}
              className="w-full rounded-xl text-sm border border-gray-200 bg-gray-50 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 resize-none"
            />
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleSaveChanges}
              disabled={!isValid}
              className="flex-1 rounded-xl gap-2 bg-indigo-600 hover:bg-indigo-700 h-10 disabled:opacity-40"
            >
              <Check className="w-4 h-4" />
              Save Changes
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditing(false);
                setEditedInvoice(invoice);
                setEditedClientName(client?.name || invoice.clientName);
                setEditedClientEmail(client?.email || "");
                setTouched({});
              }}
              className="rounded-xl px-5"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── INVOICE DOCUMENT ── */}
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#4F46E5" }}
            >
              <Zap className="w-4 h-4 text-white" fill="white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Ledger</p>
              <p className="text-xs text-gray-400">Invoice Platform</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-gray-900 tracking-tight uppercase">
              Invoice
            </p>
            {invoiceNumber ? (
              <p className="text-xs font-semibold text-indigo-600 mt-0.5">
                {invoiceNumber}
              </p>
            ) : (
              <p className="text-xs text-gray-300 mt-0.5">Draft</p>
            )}
          </div>
        </div>

        {/* From / Bill To */}
        <div className="flex justify-between pt-2 border-t border-gray-100">
          <div className="max-w-[48%]">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              From
            </p>
            <p className="text-sm font-bold text-gray-900">{senderName}</p>
            {profile?.address && (
              <p className="text-xs text-gray-500 mt-0.5">{profile.address}</p>
            )}
            {[profile?.city, profile?.state].filter(Boolean).join(", ") && (
              <p className="text-xs text-gray-500 mt-0.5">
                {[profile?.city, profile?.state].filter(Boolean).join(", ")}
              </p>
            )}
            {profile?.pincode && (
              <p className="text-xs text-gray-500 mt-0.5">{profile.pincode}</p>
            )}
          </div>
          <div className="text-right max-w-[48%]">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              Bill To
            </p>
            <p className="text-sm font-bold text-gray-900">
              {displayClientName}
            </p>
            {displayClientEmail && (
              <p className="text-xs text-gray-500 mt-0.5">
                {displayClientEmail}
              </p>
            )}
            {clientAddress && (
              <p className="text-xs text-gray-500 mt-0.5">{clientAddress}</p>
            )}
            {clientLocationLine && (
              <p className="text-xs text-gray-500 mt-0.5">
                {clientLocationLine}
              </p>
            )}
            {clientPincode && (
              <p className="text-xs text-gray-500 mt-0.5">{clientPincode}</p>
            )}
          </div>
        </div>

        {/* Dates + Place of supply */}
        <div className="flex gap-6 flex-wrap">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Issue Date</p>
            <p className="text-xs font-semibold text-gray-800">{issueDate}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Due Date</p>
            <p className="text-xs font-semibold text-gray-800">{dueDate}</p>
          </div>
          {current.placeOfSupply && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Place of Supply</p>
              <p className="text-xs font-semibold text-gray-800">
                {current.placeOfSupply}
              </p>
            </div>
          )}
          {current.invoiceMonth && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Invoice Month</p>
              <p className="text-xs font-semibold text-gray-800">
                {current.invoiceMonth}
              </p>
            </div>
          )}
        </div>

        {/* Line items table */}
        <div>
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 rounded-t-xl">
            <div className="col-span-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Description
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                HSN/SAC
              </p>
            </div>
            <div className="col-span-2 text-center">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Qty
              </p>
            </div>
            <div className="col-span-2 text-right">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Rate
              </p>
            </div>
            <div className="col-span-2 text-right">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Amount
              </p>
            </div>
          </div>
          <div className="border border-t-0 border-gray-100 rounded-b-xl overflow-hidden divide-y divide-gray-50">
            {current.lineItems?.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-2 px-3 py-3 bg-white"
              >
                <div className="col-span-4">
                  <p className="text-sm text-gray-800 font-medium">
                    {String(item.description ?? "")}
                  </p>
                </div>
                <div className="col-span-2">
                  {item.hsnSacCode ? (
                    <span className="text-xs font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                      {item.hsnSacCode}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </div>
                <div className="col-span-2 text-center">
                  <p className="text-sm text-gray-600">{item.quantity}</p>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-sm text-gray-600">
                    {/* {formatCurrency(Number(item.rate))} */}
                    {item.rate}
                  </p>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {/* {formatCurrency(item.amount)} */}
                    {item.amount}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-xs text-gray-500">Subtotal</span>
              <span className="text-xs font-medium text-gray-700">
                {formatCurrency(current.subtotal)}
              </span>
            </div>

            {/* Discount row */}
            {hasDiscount && (
              <div className="flex justify-between text-emerald-600">
                <span className="text-xs">
                  Discount
                  {current.discountType === "percent"
                    ? ` (${current.discountValue}%)`
                    : ""}
                </span>
                <span className="text-xs font-medium">
                  − {formatCurrency(current.discountAmount || 0)}
                </span>
              </div>
            )}

            {/* Taxable amount (only show if discount applied) */}
            {hasDiscount && (
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Taxable Amount</span>
                <span className="text-xs font-medium text-gray-700">
                  {formatCurrency(current.taxableAmount || current.subtotal)}
                </span>
              </div>
            )}

            {/* GST split */}
            {showCgstSgst ? (
              <>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">
                    CGST ({current.cgstPercent || current.gstPercent / 2}%)
                  </span>
                  <span className="text-xs font-medium text-gray-700">
                    {formatCurrency(
                      current.cgstAmount || current.gstAmount / 2
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">
                    SGST ({current.sgstPercent || current.gstPercent / 2}%)
                  </span>
                  <span className="text-xs font-medium text-gray-700">
                    {formatCurrency(
                      current.sgstAmount || current.gstAmount / 2
                    )}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">
                  IGST ({current.igstPercent || current.gstPercent}%)
                </span>
                <span className="text-xs font-medium text-gray-700">
                  {formatCurrency(current.igstAmount || current.gstAmount)}
                </span>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-sm font-bold text-gray-900">Total</span>
              <span className="text-sm font-bold text-gray-900">
                {formatCurrency(current.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {current.notes && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Notes
            </p>
            <p className="text-xs text-gray-600 whitespace-pre-wrap">
              {current.notes}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded flex items-center justify-center"
              style={{ background: "#4F46E5" }}
            >
              <Zap className="w-2.5 h-2.5 text-white" fill="white" />
            </div>
            <span className="text-xs text-gray-400">
              Generated by{" "}
              <span className="font-semibold text-gray-600">Ledger</span>
            </span>
          </div>
          <span className="text-xs font-medium text-gray-500">
            Net {current.paymentTermsDays} days
          </span>
        </div>
      </div>

      {/* ── ACTIONS ── */}
      {!isEditing && (
        <div className="px-5 pb-5 flex items-center gap-2">
          {isConfirmed ? (
            <div className="w-full flex items-center gap-2 justify-end">
              {invoiceNumber && (
                <DownloadPDFButton
                  invoice={current}
                  invoiceNumber={invoiceNumber}
                  userName={userName}
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
                className="rounded-xl border border-gray-200 h-10 w-10"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl border border-gray-200 h-10 w-10"
              >
                <Send className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDiscard}
                className="rounded-xl border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 h-10 w-10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <Button
                onClick={() => onConfirm(current)}
                className="flex-1 rounded-xl gap-2 bg-indigo-600 hover:bg-indigo-700 h-10"
                style={{ boxShadow: "0 4px 12px rgba(79,70,229,0.25)" }}
              >
                <Check className="w-4 h-4" />
                Confirm Invoice
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
                className="rounded-xl border border-gray-200 h-10 w-10"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDiscard}
                className="rounded-xl border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 h-10 w-10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
