import { z } from "zod";

export const INDIAN_STATES: string[] = [
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

// ── Shared field rules ──
export const companySchema = z.object({
  businessName: z.string().min(2, "Name must be at least 2 characters"),
  gstin: z
    .string()
    .optional()
    .refine(
      (val) =>
        !val ||
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val),
      "Invalid GSTIN format (e.g. 22AAAAA0000A1Z5)"
    ),
  pan: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val),
      "Invalid PAN format (e.g. AAAAA0000A)"
    ),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[6-9]\d{9}$/.test(val.replace(/[\s+\-()]/g, "")),
      "Invalid Indian phone number"
    ),
});

export const addressSchema = z.object({
  address: z.string().min(3, "Address is required"),
  city: z
    .string()
    .min(2, "City is required")
    .refine(
      (val) => /^[a-zA-Z\s]+$/.test(val),
      "City can only contain alphabets"
    ),
  state: z.string().min(1, "State is required"),
  pincode: z
    .string()
    .min(1, "Pincode is required")
    .refine((val) => /^[1-9][0-9]{5}$/.test(val), "Invalid pincode (6 digits)"),
});

export const bankSchema = z.object({
  bankName: z.string().optional(),
  accountNumber: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^\d{9,18}$/.test(val),
      "Account number must be 9-18 digits"
    ),
  ifscCode: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(val),
      "Invalid IFSC code (e.g. HDFC0001234)"
    ),
  upiId: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(val),
      "Invalid UPI ID (e.g. name@upi)"
    ),
});

// ── Full profile schema (used in ProfilePage) ──
export const profileSchema = companySchema
  .merge(addressSchema)
  .merge(bankSchema);

export type CompanyErrors = Partial<
  Record<keyof z.infer<typeof companySchema>, string>
>;
export type AddressErrors = Partial<
  Record<keyof z.infer<typeof addressSchema>, string>
>;
export type BankErrors = Partial<
  Record<keyof z.infer<typeof bankSchema>, string>
>;

// ── Parse issues into error map ──
export function parseIssues<T extends Record<string, string>>(
  issues: z.ZodIssue[]
): Partial<T> {
  const errors: Partial<T> = {};
  issues.forEach((e) => {
    const field = e.path[0] as keyof T;
    if (!errors[field]) errors[field] = e.message as T[keyof T];
  });
  return errors;
}

export function parseProfileIssues(
  issues: z.ZodIssue[]
): Record<string, string> {
  const errors: Record<string, string> = {};

  issues.forEach((e) => {
    const field = e.path[0] as string;
    if (!errors[field]) {
      errors[field] = e.message;
    }
  });

  return errors;
}

// ── Field class helper ──
export function fieldClass(hasError: boolean) {
  return `rounded-xl focus-visible:ring-indigo-400 ${
    hasError ? "border-red-400 focus-visible:ring-red-400" : ""
  }`;
}
