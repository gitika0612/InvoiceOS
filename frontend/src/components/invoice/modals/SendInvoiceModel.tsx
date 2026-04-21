import { useState, useEffect } from "react";
import {
  Mail,
  Building2,
  MapPin,
  Loader2,
  Send,
  CheckCircle2,
  X,
} from "lucide-react";
import { useUser } from "@clerk/clerk-react";
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { getClientByName, upsertClient, ClientAPI } from "@/lib/api/clientApi";
import api from "@/lib/api/api";

interface SendInvoiceModalProps {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  total: number;
  onClose: () => void;
  onSent: (clientEmail: string) => void;
}

interface ClientForm {
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
}

const emptyForm: ClientForm = {
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  gstin: "",
};

type Step = "details" | "confirm" | "sent";

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function SendInvoiceModal({
  invoiceId,
  invoiceNumber,
  clientName,
  total,
  onClose,
  onSent,
}: SendInvoiceModalProps) {
  const { user } = useUser();
  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [loadingClient, setLoadingClient] = useState(true);
  const [existingClient, setExistingClient] = useState<ClientAPI | null>(null);
  const [sending, setSending] = useState(false);

  // Auto-fill if client exists
  useEffect(() => {
    if (!user || !clientName) return;

    (async () => {
      try {
        const client = await getClientByName(user.id, clientName);
        if (client) {
          setExistingClient(client);
          setForm({
            email: client.email || "",
            phone: client.phone || "",
            address: client.address || "",
            city: client.city || "",
            state: client.state || "",
            pincode: client.pincode || "",
            gstin: client.gstin || "",
          });
        }
      } catch (err) {
        console.error("Failed to fetch client:", err);
      } finally {
        setLoadingClient(false);
      }
    })();
  }, [user, clientName]);

  const handleChange = (field: keyof ClientForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleContinue = () => {
    if (!form.email.trim()) return;
    setStep("confirm");
  };

  const handleSend = async () => {
    if (!user) return;
    setSending(true);

    try {
      // 1. Save/update client
      await upsertClient(user.id, {
        name: clientName,
        email: form.email.trim(),
        phone: form.phone,
        address: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        gstin: form.gstin,
      });

      // 2. Update invoice status to sent + link client
      await api.put(`/invoices/${invoiceId}`, {
        status: "sent",
        clientEmail: form.email.trim(),
      });

      // 3. Move to sent step
      setStep("sent");
      onSent(form.email.trim());
    } catch (err) {
      console.error("Failed to send invoice:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && !sending && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 rounded-2xl overflow-hidden [&>button]:hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-5 border-b border-gray-100 space-y-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Send className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-gray-900">
                  Send Invoice
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400 mt-0.5">
                  {invoiceNumber} · {formatINR(total)}
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={sending}
              className="w-8 h-8 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* ── Step: Details ── */}
        {step === "details" && (
          <div className="px-6 py-5 space-y-5">
            {/* Client name — read only */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                {clientName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {clientName}
                </p>
                {existingClient && (
                  <Badge className="text-xs text-emerald-600 bg-emerald-50 border-emerald-100 rounded-full px-2 py-0 font-normal mt-0.5">
                    Returning client
                  </Badge>
                )}
              </div>
            </div>

            {loadingClient ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Email — required */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    Client Email *
                  </Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="Enter email"
                    className="rounded-xl focus-visible:ring-indigo-400"
                  />
                </div>

                <Separator />

                {/* Optional fields */}
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                  <Building2 className="w-3 h-3" />
                  Client Details
                  <span className="font-normal normal-case text-gray-300">
                    — optional
                  </span>
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500">
                      Phone
                    </Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      placeholder="Enter phone no."
                      className="rounded-xl focus-visible:ring-indigo-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500">
                      GSTIN
                    </Label>
                    <Input
                      value={form.gstin}
                      onChange={(e) =>
                        handleChange("gstin", e.target.value.toUpperCase())
                      }
                      placeholder="Enter GSTIN"
                      maxLength={15}
                      className="rounded-xl focus-visible:ring-indigo-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Address
                  </Label>
                  <Input
                    value={form.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    placeholder="Street address"
                    className="rounded-xl focus-visible:ring-indigo-400"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500">
                      City
                    </Label>
                    <Input
                      value={form.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      placeholder="Enter City"
                      className="rounded-xl focus-visible:ring-indigo-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500">
                      State
                    </Label>
                    <Input
                      value={form.state}
                      onChange={(e) => handleChange("state", e.target.value)}
                      placeholder="Enter State"
                      className="rounded-xl focus-visible:ring-indigo-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500">
                      Pincode
                    </Label>
                    <Input
                      value={form.pincode}
                      onChange={(e) => handleChange("pincode", e.target.value)}
                      placeholder="Enter pincode"
                      maxLength={6}
                      className="rounded-xl focus-visible:ring-indigo-400"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleContinue}
                disabled={!form.email.trim() || loadingClient}
                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 gap-2"
              >
                Continue
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Confirm ── */}
        {step === "confirm" && (
          <div className="px-6 py-5 space-y-5">
            <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Invoice Summary
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Invoice</span>
                  <span className="font-semibold text-gray-900">
                    {invoiceNumber}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Client</span>
                  <span className="font-semibold text-gray-900">
                    {clientName}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Email</span>
                  <span className="font-semibold text-gray-900">
                    {form.email}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-gray-900">Total</span>
                  <span className="text-indigo-600">{formatINR(total)}</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-700 leading-relaxed">
                <span className="font-semibold">Note:</span> The invoice status
                will be updated to <strong>Sent</strong> and the client details
                will be saved for future use.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("details")}
                className="flex-1 rounded-xl"
                disabled={sending}
              >
                Back
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 gap-2"
                style={{ boxShadow: "0 4px 12px rgba(79,70,229,0.3)" }}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Confirm & Send
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Sent ── */}
        {step === "sent" && (
          <div className="px-6 py-10 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">Invoice Sent!</p>
              <p className="text-sm text-gray-400 mt-1">
                {invoiceNumber} has been sent to
              </p>
              <p className="text-sm font-semibold text-indigo-600 mt-0.5">
                {form.email}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 w-full text-left space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Client</span>
                <span className="font-medium text-gray-700">{clientName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Amount</span>
                <span className="font-medium text-gray-700">
                  {formatINR(total)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Status</span>
                <Badge className="text-xs text-blue-600 bg-blue-50 border-blue-100 rounded-full px-2 py-0 font-normal">
                  Sent
                </Badge>
              </div>
            </div>
            <Button
              onClick={onClose}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 mt-2"
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
