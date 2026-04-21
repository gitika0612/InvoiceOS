import { z } from "zod";

export const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit: z.string(),
  rate: z.number(),
  amount: z.number(),
  hsnSacCode: z
    .string()
    .describe(
      "SAC code for services, HSN for goods. " +
        "Common SAC: 998314=software dev, 998312=web design, " +
        "998313=IT consulting, 998315=data processing, 998319=other IT"
    ),
  hsnSacType: z.enum(["HSN", "SAC"]).describe("HSN=goods, SAC=services"),
});

export const invoiceSchema = z.object({
  intent: z.enum(["new", "edit", "copy"]),
  targetInvoiceRef: z.string(),
  clientName: z.string(),
  lineItems: z.array(lineItemSchema),
  gstPercent: z.number(),
  gstType: z.enum(["IGST", "CGST_SGST"]),
  discountType: z.enum(["percent", "amount", "none"]),
  discountValue: z.number(),
  notes: z.string(),
  subtotal: z.number(),
  discountAmount: z.number(),
  taxableAmount: z.number(),
  gstAmount: z.number(),
  cgstAmount: z.number(),
  sgstAmount: z.number(),
  igstAmount: z.number(),
  total: z.number(),
  paymentTermsDays: z.number(),
  invoiceDate: z.string(),
  invoiceMonth: z.string(),
  changedFields: z.array(z.string()),
});

export const multiInvoiceSchema = z.object({
  isMultiple: z.boolean(),
  count: z.number(),
  subPrompts: z.array(z.string()),
});

export type ParsedInvoice = z.infer<typeof invoiceSchema>;
export type MultiInvoiceDetection = z.infer<typeof multiInvoiceSchema>;
