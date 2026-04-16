import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

const lineItemSchema = z.object({
  description: z.string().describe("Description of this line item"),
  quantity: z.number().describe("Quantity for this item"),
  unit: z.string().describe("Unit: days, hours, items, etc"),
  rate: z.number().describe("Rate per unit in INR"),
  amount: z.number().describe("quantity × rate"),
});

const invoiceSchema = z.object({
  clientName: z.string().describe("Name of the client"),
  lineItems: z.array(lineItemSchema).describe("All line items in the invoice"),
  gstPercent: z.number().describe("GST percentage, default 18"),
  paymentTermsDays: z.number().describe("Payment terms in days, default 15"),
  subtotal: z.number().describe("Sum of all line item amounts"),
  gstAmount: z.number().describe("subtotal × gstPercent / 100"),
  total: z.number().describe("subtotal + gstAmount"),
  invoiceDate: z
    .string()
    .describe(
      'Specific invoice date in YYYY-MM-DD format if mentioned in prompt. Return empty string "" if not mentioned.'
    ),
  invoiceMonth: z
    .string()
    .describe(
      'Month this invoice is for e.g. "January 2026". Extract if month mentioned in prompt. Return empty string "" if not mentioned.'
    ),
});

const multiInvoiceSchema = z.object({
  isMultiple: z
    .boolean()
    .describe("True if prompt requests multiple separate invoices"),
  count: z.number().describe("Number of invoices requested"),
  subPrompts: z
    .array(z.string())
    .describe(
      "Individual self-contained prompt for each invoice with client name, description, amount, GST and payment terms"
    ),
});

export type ParsedInvoice = z.infer<typeof invoiceSchema>;
export type MultiInvoiceDetection = z.infer<typeof multiInvoiceSchema>;

const INVOICE_PROMPT = `You are an expert invoice parser for Indian freelancers and businesses.

Parse the following invoice request and extract ALL invoice details.

Rules:
- Extract each service/item as a separate line item
- If amount is given directly (e.g. ₹20,000), use quantity=1, rate=that amount
- If "k" format used (e.g. 10k), convert to full number (10000)
- If GST not mentioned, assume 18%
- If payment terms not mentioned, default to 15 days
- "standard payment terms" means 30 days
- "net 7" or "7 days" means paymentTermsDays = 7
- Return all amounts as plain numbers without currency symbols
- If a specific month is mentioned (e.g. "for January", "March invoice"), 
  extract as invoiceMonth in format "Month YYYY" e.g. "January 2026"
- If a specific date is mentioned, extract as invoiceDate in YYYY-MM-DD format
- If no date/month mentioned, leave invoiceDate and invoiceMonth empty
- Calculate: subtotal = sum of all line item amounts
- Calculate: gstAmount = subtotal × gstPercent / 100
- Calculate: total = subtotal + gstAmount

Invoice Request: {prompt}`;

const MULTI_DETECT_PROMPT = `You are an invoice assistant. Analyze if this prompt requests multiple SEPARATE invoices.

Examples of MULTIPLE invoices:
- "Create 3 invoices for Jan, Feb, March"
- "Bill Rahul for January and February separately"
- "Create monthly invoices for 6 months"
- "Invoice Rahul for Q1 - January, February, March separately"

Examples of SINGLE invoice (even with multiple line items):
- "Invoice Rahul for logo design, brand guidelines and 3 revisions"
- "Bill Priya for development work and bug fixes"
- "Invoice Ankit for design ₹20k and development ₹30k"

If multiple, split into individual SELF-CONTAINED prompts.
Each sub-prompt must include: client name, description, amount, GST%, payment terms, and month if applicable.

Original prompt: {prompt}`;

function getModel() {
  return new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });
}

export async function detectMultiInvoice(
  prompt: string
): Promise<MultiInvoiceDetection> {
  const model = getModel();
  const structuredModel = model.withStructuredOutput(multiInvoiceSchema);
  const promptTemplate = PromptTemplate.fromTemplate(MULTI_DETECT_PROMPT);
  const formatted = await promptTemplate.format({ prompt });
  return await structuredModel.invoke(formatted);
}

export async function parseInvoiceWithAI(
  prompt: string
): Promise<ParsedInvoice> {
  const model = getModel();
  const structuredModel = model.withStructuredOutput(invoiceSchema);
  const promptTemplate = PromptTemplate.fromTemplate(INVOICE_PROMPT);
  const formatted = await promptTemplate.format({ prompt });
  return await structuredModel.invoke(formatted);
}

export async function parseMultipleInvoices(
  subPrompts: string[]
): Promise<ParsedInvoice[]> {
  return await Promise.all(subPrompts.map((p) => parseInvoiceWithAI(p)));
}
