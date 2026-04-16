import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Landmark,
  Save,
  CheckCircle2,
  Loader2,
  FileText,
} from "lucide-react";
import { useAuth, UserProfile } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu & Kashmir",
  "Ladakh",
];

const emptyProfile: UserProfile = {
  businessName: "",
  gstin: "",
  pan: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  bankName: "",
  accountNumber: "",
  ifscCode: "",
  upiId: "",
};

type SaveState = "idle" | "saving" | "saved";

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, getUserProfile, updateUserProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const data = await getUserProfile();
      if (data) {
        setProfile({
          businessName: data.businessName || "",
          gstin: data.gstin || "",
          pan: data.pan || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          pincode: data.pincode || "",
          phone: data.phone || "",
          bankName: data.bankName || "",
          accountNumber: data.accountNumber || "",
          ifscCode: data.ifscCode || "",
          upiId: data.upiId || "",
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const handleChange = (field: keyof UserProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    if (saveState === "saved") setSaveState("idle");
  };

  const handleSave = async () => {
    setSaveState("saving");
    const result = await updateUserProfile(profile);
    if (result) {
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 3000);
    } else {
      setSaveState("idle");
    }
  };

  const completionFields = [
    profile.businessName,
    profile.gstin,
    profile.address,
    profile.city,
    profile.state,
    profile.phone,
    profile.bankName,
    profile.accountNumber,
    profile.ifscCode,
  ];
  const completionPercent = Math.round(
    (completionFields.filter(Boolean).length / completionFields.length) * 100
  );

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Sticky Header ── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="rounded-xl text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-sm font-bold text-gray-900">
                Business Profile
              </h1>
              <p className="text-xs text-gray-400">
                Auto-fills your invoices · {completionPercent}% complete
              </p>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saveState === "saving"}
            className={`gap-2 rounded-xl ${
              saveState === "saved"
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-50"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }`}
          >
            {saveState === "saving" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveState === "saved" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saveState === "saving"
              ? "Saving..."
              : saveState === "saved"
              ? "Saved!"
              : "Save Profile"}
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-gray-100">
          <div
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Account banner */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 flex items-center gap-4">
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={user?.imageUrl} />
            <AvatarFallback className="bg-indigo-600 text-white font-bold text-sm">
              {user?.firstName?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-indigo-900">
              {user?.fullName || user?.firstName || "Your Account"}
            </p>
            <p className="text-xs text-indigo-400 truncate">
              {user?.emailAddresses?.[0]?.emailAddress}
            </p>
          </div>
          <Badge className="text-xs text-indigo-500 bg-white border border-indigo-200 rounded-full font-normal hover:bg-white">
            Synced via Clerk
          </Badge>
        </div>

        {/* Business Details */}
        <Section icon={Building2} title="Business Details">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FieldWrapper label="Business / Freelancer Name *">
                <Input
                  value={profile.businessName}
                  onChange={(e) => handleChange("businessName", e.target.value)}
                  placeholder="e.g. Gitika Bhatia Design Studio"
                  className="rounded-xl focus-visible:ring-indigo-400"
                />
              </FieldWrapper>
            </div>
            <FieldWrapper label="GSTIN">
              <Input
                value={profile.gstin}
                onChange={(e) =>
                  handleChange("gstin", e.target.value.toUpperCase())
                }
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
                className="rounded-xl focus-visible:ring-indigo-400"
              />
            </FieldWrapper>
            <FieldWrapper label="PAN">
              <Input
                value={profile.pan}
                onChange={(e) =>
                  handleChange("pan", e.target.value.toUpperCase())
                }
                placeholder="AAAAA0000A"
                maxLength={10}
                className="rounded-xl focus-visible:ring-indigo-400"
              />
            </FieldWrapper>
            <FieldWrapper label="Phone">
              <Input
                value={profile.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+91 98765 43210"
                className="rounded-xl focus-visible:ring-indigo-400"
              />
            </FieldWrapper>
          </div>
        </Section>

        {/* Address */}
        <Section icon={MapPin} title="Business Address">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FieldWrapper label="Street Address">
                <Input
                  value={profile.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="123, Street Name, Area"
                  className="rounded-xl focus-visible:ring-indigo-400"
                />
              </FieldWrapper>
            </div>
            <FieldWrapper label="City">
              <Input
                value={profile.city}
                onChange={(e) => handleChange("city", e.target.value)}
                placeholder="Mumbai"
                className="rounded-xl focus-visible:ring-indigo-400"
              />
            </FieldWrapper>
            <FieldWrapper label="State">
              <Select
                value={profile.state}
                onValueChange={(val) => handleChange("state", val)}
              >
                <SelectTrigger className="rounded-xl focus:ring-indigo-400">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Pincode">
              <Input
                value={profile.pincode}
                onChange={(e) => handleChange("pincode", e.target.value)}
                placeholder="400001"
                maxLength={6}
                className="rounded-xl focus-visible:ring-indigo-400"
              />
            </FieldWrapper>
          </div>
        </Section>

        {/* Bank Details */}
        <Section icon={Landmark} title="Bank Details">
          <p className="text-xs text-gray-400 mb-4">
            Shown on invoice for direct bank transfers
          </p>
          <div className="grid grid-cols-2 gap-4">
            <FieldWrapper label="Bank Name">
              <Input
                value={profile.bankName}
                onChange={(e) => handleChange("bankName", e.target.value)}
                placeholder="HDFC Bank"
                className="rounded-xl focus-visible:ring-indigo-400"
              />
            </FieldWrapper>
            <FieldWrapper label="Account Number">
              <Input
                value={profile.accountNumber}
                onChange={(e) => handleChange("accountNumber", e.target.value)}
                placeholder="1234567890"
                className="rounded-xl focus-visible:ring-indigo-400"
              />
            </FieldWrapper>
            <FieldWrapper label="IFSC Code">
              <Input
                value={profile.ifscCode}
                onChange={(e) =>
                  handleChange("ifscCode", e.target.value.toUpperCase())
                }
                placeholder="HDFC0001234"
                className="rounded-xl focus-visible:ring-indigo-400"
              />
            </FieldWrapper>
            <FieldWrapper label="UPI ID">
              <Input
                value={profile.upiId}
                onChange={(e) => handleChange("upiId", e.target.value)}
                placeholder="yourname@upi"
                className="rounded-xl focus-visible:ring-indigo-400"
              />
            </FieldWrapper>
          </div>
        </Section>

        {/* Info hint */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4">
          <div className="flex items-start gap-3">
            <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-700">
                How this appears on invoices
              </p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Your business name, GSTIN, address and bank details will
                automatically appear on every PDF invoice you generate.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom save */}
        <Button
          onClick={handleSave}
          disabled={saveState === "saving"}
          className="w-full rounded-2xl py-3 h-auto gap-2 bg-indigo-600 hover:bg-indigo-700"
          style={{ boxShadow: "0 4px 12px rgba(79,70,229,0.3)" }}
        >
          {saveState === "saving" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saveState === "saved" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saveState === "saving"
            ? "Saving..."
            : saveState === "saved"
            ? "Profile Saved!"
            : "Save Profile"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-indigo-600" />
        </div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldWrapper({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-gray-500">{label}</Label>
      {children}
    </div>
  );
}
