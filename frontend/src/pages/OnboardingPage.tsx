import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  MapPin,
  Landmark,
  CheckCircle2,
  Loader2,
  Zap,
  ArrowRight,
  Sparkles,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { useAuth, UserProfile } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  INDIAN_STATES,
  companySchema,
  addressSchema,
  bankSchema,
  CompanyErrors,
  AddressErrors,
  BankErrors,
  parseIssues,
  fieldClass,
} from "@/lib/profileValidation";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

type Step = "welcome" | "company" | "address" | "bank";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, getUserProfile, updateUserProfile, syncUser } = useAuth();
  const [step, setStep] = useState<Step>("welcome");
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [saving, setSaving] = useState(false);
  const [checkingOnboarded, setCheckingOnboarded] = useState(true);
  const [companyErrors, setCompanyErrors] = useState<CompanyErrors>({});
  const [addressErrors, setAddressErrors] = useState<AddressErrors>({});
  const [bankErrors, setBankErrors] = useState<BankErrors>({});
  const [openStateDropdown, setOpenStateDropdown] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const data = await getUserProfile();
      if (data?.isOnboarded) {
        navigate("/dashboard");
        return;
      }
      setCheckingOnboarded(false);
    })();
  }, [user, getUserProfile, navigate]);

  const handleChange = (field: keyof UserProfile, value: string) => {
    const updated = { ...profile, [field]: value };
    setProfile(updated);

    // Company step live validation
    if (["businessName", "gstin", "pan", "phone"].includes(field)) {
      const result = companySchema.safeParse({
        businessName: updated.businessName,
        gstin: updated.gstin || undefined,
        pan: updated.pan || undefined,
        phone: updated.phone || undefined,
      });

      if (!result.success) {
        const fieldErrors = parseIssues(result.error.issues);

        setCompanyErrors((prev) => ({
          ...prev,
          [field]: fieldErrors[field] || undefined,
        }));
      } else {
        setCompanyErrors((prev) => ({
          ...prev,
          [field]: undefined,
        }));
      }
    }

    // Address step live validation
    if (["address", "city", "state", "pincode"].includes(field)) {
      const result = addressSchema.safeParse({
        address: updated.address,
        city: updated.city,
        state: updated.state,
        pincode: updated.pincode,
      });

      if (!result.success) {
        const fieldErrors = parseIssues(result.error.issues);

        setAddressErrors((prev) => ({
          ...prev,
          [field]: fieldErrors[field] || undefined,
        }));
      } else {
        setAddressErrors((prev) => ({
          ...prev,
          [field]: undefined,
        }));
      }
    }

    // Bank step live validation
    if (["bankName", "accountNumber", "ifscCode", "upiId"].includes(field)) {
      const result = bankSchema.safeParse({
        bankName: updated.bankName || undefined,
        accountNumber: updated.accountNumber || undefined,
        ifscCode: updated.ifscCode || undefined,
        upiId: updated.upiId || undefined,
      });

      if (!result.success) {
        const fieldErrors = parseIssues(result.error.issues);

        setBankErrors((prev) => ({
          ...prev,
          [field]: fieldErrors[field] || undefined,
        }));
      } else {
        setBankErrors((prev) => ({
          ...prev,
          [field]: undefined,
        }));
      }
    }
  };

  const handleSkip = () => navigate("/dashboard");

  const validateCompany = (): boolean => {
    const result = companySchema.safeParse({
      businessName: profile.businessName,
      gstin: profile.gstin || undefined,
      pan: profile.pan || undefined,
      phone: profile.phone || undefined,
    });
    if (!result.success) {
      setCompanyErrors(parseIssues<CompanyErrors>(result.error.issues));
      return false;
    }
    setCompanyErrors({});
    return true;
  };

  const validateAddress = (): boolean => {
    const result = addressSchema.safeParse({
      address: profile.address,
      city: profile.city,
      state: profile.state,
      pincode: profile.pincode,
    });
    if (!result.success) {
      setAddressErrors(parseIssues<AddressErrors>(result.error.issues));
      return false;
    }
    setAddressErrors({});
    return true;
  };

  const validateBank = (): boolean => {
    const result = bankSchema.safeParse({
      bankName: profile.bankName || undefined,
      accountNumber: profile.accountNumber || undefined,
      ifscCode: profile.ifscCode || undefined,
      upiId: profile.upiId || undefined,
    });
    if (!result.success) {
      setBankErrors(parseIssues<BankErrors>(result.error.issues));
      return false;
    }
    setBankErrors({});
    return true;
  };

  const handleNextCompany = () => {
    if (validateCompany()) setStep("address");
  };
  const handleNextAddress = () => {
    if (validateAddress()) setStep("bank");
  };

  const handleFinish = async () => {
    if (!validateBank()) return;
    setSaving(true);
    try {
      await syncUser();
      await updateUserProfile({
        ...profile,
        isOnboarded: true,
      });
      const updatedProfile = await getUserProfile();
      if (updatedProfile?.isOnboarded) {
        setProfile(emptyProfile);
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Onboarding save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = (toStep: Step) => {
    setCompanyErrors({});
    setAddressErrors({});
    setBankErrors({});
    setStep(toStep);
  };

  if (checkingOnboarded) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "#4F46E5" }}
          >
            <Zap className="w-5 h-5 text-white" fill="white" />
          </div>
          <span className="text-xl font-bold text-gray-900">Ledger</span>
        </div>

        {/* ── Welcome ── */}
        {step === "welcome" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome, {user?.firstName || "there"}! 👋
              </h1>
              <p className="text-sm text-gray-500 leading-relaxed">
                Let's set up your company profile. This information will
                automatically appear on every document you create.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
              {[
                "Company name & GSTIN on every invoice",
                "Bank details for seamless payment collection",
                "Professional address for compliance",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <p className="text-xs text-gray-600">{item}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSkip}
                className="flex-1 rounded-xl text-gray-500"
              >
                Skip for now
              </Button>
              <Button
                onClick={() => setStep("company")}
                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 gap-2"
                style={{ boxShadow: "0 4px 12px rgba(79,70,229,0.3)" }}
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Company ── */}
        {step === "company" && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <StepHeader
              icon={Building2}
              title="Company Details"
              subtitle="Step 1 of 3"
              progress={33}
            />
            <div className="p-6 space-y-4">
              <FieldWrapper
                label="Company / Freelancer Name"
                required
                error={companyErrors.businessName}
              >
                <Input
                  value={profile.businessName}
                  onChange={(e) => handleChange("businessName", e.target.value)}
                  placeholder="Enter company / freelancer name"
                  className={fieldClass(!!companyErrors.businessName)}
                />
              </FieldWrapper>
              <div className="grid grid-cols-2 gap-4">
                <FieldWrapper label="GSTIN" error={companyErrors.gstin}>
                  <Input
                    value={profile.gstin}
                    onChange={(e) =>
                      handleChange("gstin", e.target.value.toUpperCase())
                    }
                    placeholder="Enter GSTIN"
                    maxLength={15}
                    className={fieldClass(!!companyErrors.gstin)}
                  />
                </FieldWrapper>
                <FieldWrapper label="PAN" error={companyErrors.pan}>
                  <Input
                    value={profile.pan}
                    onChange={(e) =>
                      handleChange("pan", e.target.value.toUpperCase())
                    }
                    placeholder="Enter PAN"
                    maxLength={10}
                    className={fieldClass(!!companyErrors.pan)}
                  />
                </FieldWrapper>
              </div>
              <FieldWrapper label="Phone" error={companyErrors.phone}>
                <Input
                  value={profile.phone}
                  onChange={(e) =>
                    handleChange(
                      "phone",
                      e.target.value.replace(/\D/g, "").slice(0, 10)
                    )
                  }
                  placeholder="Enter phone no."
                  inputMode="numeric"
                  maxLength={10}
                  className={fieldClass(!!companyErrors.phone)}
                />
              </FieldWrapper>
            </div>
            <StepFooter
              onBack={() => handleBack("welcome")}
              onNext={handleNextCompany}
              disabled={!profile.businessName.trim()}
            />
          </div>
        )}

        {/* ── Address ── */}
        {step === "address" && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <StepHeader
              icon={MapPin}
              title="Business Address"
              subtitle="Step 2 of 3"
              progress={66}
            />
            <div className="p-6 space-y-4">
              <FieldWrapper
                label="Address"
                required
                error={addressErrors.address}
              >
                <Input
                  value={profile.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="Enter address"
                  className={fieldClass(!!addressErrors.address)}
                />
              </FieldWrapper>
              <div className="grid grid-cols-2 gap-4">
                <FieldWrapper label="City" required error={addressErrors.city}>
                  <Input
                    value={profile.city}
                    onChange={(e) =>
                      handleChange(
                        "city",
                        e.target.value.replace(/[^a-zA-Z\s]/g, "")
                      )
                    }
                    placeholder="Enter city"
                    className={fieldClass(!!addressErrors.city)}
                  />
                </FieldWrapper>
                <FieldWrapper
                  label="State"
                  required
                  error={addressErrors.state}
                >
                  <Popover
                    open={openStateDropdown}
                    onOpenChange={setOpenStateDropdown}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={`w-full justify-between ${fieldClass(
                          !!addressErrors.state
                        )}`}
                      >
                        {profile.state || "Select state"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search state..." />

                        <CommandEmpty>No state found.</CommandEmpty>

                        <CommandGroup className="max-h-60 overflow-y-auto">
                          {INDIAN_STATES.map((state) => (
                            <CommandItem
                              key={state}
                              value={state}
                              onSelect={(currentValue) => {
                                handleChange("state", currentValue);
                                setOpenStateDropdown(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  profile.state === state
                                    ? "opacity-100"
                                    : "opacity-0"
                                }`}
                              />
                              {state}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </FieldWrapper>
              </div>
              <FieldWrapper
                label="Pincode"
                required
                error={addressErrors.pincode}
              >
                <Input
                  value={profile.pincode}
                  onChange={(e) =>
                    handleChange(
                      "pincode",
                      e.target.value.replace(/\D/g, "").slice(0, 6)
                    )
                  }
                  placeholder="Enter pincode"
                  maxLength={6}
                  inputMode="numeric"
                  className={fieldClass(!!addressErrors.pincode)}
                />
              </FieldWrapper>
            </div>
            <StepFooter
              onBack={() => handleBack("company")}
              onNext={handleNextAddress}
              disabled={
                !profile.address.trim() ||
                !profile.city.trim() ||
                !profile.state.trim() ||
                !profile.pincode.trim()
              }
            />
          </div>
        )}

        {/* ── Bank ── */}
        {step === "bank" && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <StepHeader
              icon={Landmark}
              title="Bank Details"
              subtitle="Step 3 of 3"
              progress={100}
            />
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-400">
                Shown on invoices for direct bank transfers. You can skip and
                add later from Settings.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <FieldWrapper label="Bank Name" error={bankErrors.bankName}>
                  <Input
                    value={profile.bankName}
                    onChange={(e) =>
                      handleChange(
                        "bankName",
                        e.target.value.replace(/[^a-zA-Z\s&.]/g, "")
                      )
                    }
                    placeholder="Enter bank name"
                    className={fieldClass(!!bankErrors.bankName)}
                  />
                </FieldWrapper>
                <FieldWrapper
                  label="Account Number"
                  error={bankErrors.accountNumber}
                >
                  <Input
                    value={profile.accountNumber}
                    onChange={(e) =>
                      handleChange(
                        "accountNumber",
                        e.target.value.replace(/\D/g, "").slice(0, 18)
                      )
                    }
                    placeholder="Enter account number"
                    maxLength={18}
                    inputMode="numeric"
                    className={fieldClass(!!bankErrors.accountNumber)}
                  />
                </FieldWrapper>
                <FieldWrapper label="IFSC Code" error={bankErrors.ifscCode}>
                  <Input
                    value={profile.ifscCode}
                    onChange={(e) =>
                      handleChange(
                        "ifscCode",
                        e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, "")
                          .slice(0, 11)
                      )
                    }
                    placeholder="Enter IFSC code"
                    maxLength={11}
                    className={fieldClass(!!bankErrors.ifscCode)}
                  />
                </FieldWrapper>
                <FieldWrapper label="UPI ID" error={bankErrors.upiId}>
                  <Input
                    value={profile.upiId}
                    onChange={(e) =>
                      handleChange("upiId", e.target.value.replace(/\s/g, ""))
                    }
                    placeholder="Enter UPI ID"
                    className={fieldClass(!!bankErrors.upiId)}
                  />
                </FieldWrapper>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <Button
                variant="outline"
                onClick={() => handleBack("address")}
                disabled={saving}
                className="flex-1 rounded-xl"
              >
                Back
              </Button>
              <Button
                onClick={handleFinish}
                disabled={saving}
                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 gap-2"
                style={{ boxShadow: "0 4px 12px rgba(79,70,229,0.3)" }}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Finish Setup
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper components ──

function StepHeader({
  icon: Icon,
  title,
  subtitle,
  progress,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  progress: number;
}) {
  return (
    <div>
      <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function StepFooter({
  onBack,
  onNext,
  disabled = false,
}: {
  onBack: () => void;
  onNext: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
      <Button variant="outline" onClick={onBack} className="flex-1 rounded-xl">
        Back
      </Button>
      <Button
        onClick={onNext}
        disabled={disabled}
        className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

function FieldWrapper({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-gray-500">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
