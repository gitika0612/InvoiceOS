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
  intent: z
    .enum(["new", "edit", "copy"])
    .describe(
      "Intent: 'new' = create new invoice, 'edit' = modify existing invoice in session, 'copy' = duplicate existing invoice for new client"
    ),
  targetInvoiceRef: z
    .string()
    .describe(
      "For edit/copy: the invoice number (e.g. INV-2026-001) or client name to target. Empty string for new invoices."
    ),
  clientName: z.string().describe("Name of the client for this invoice"),
  lineItems: z.array(lineItemSchema).describe("All line items in the invoice"),
  gstPercent: z.number().describe("GST percentage, default 18"),
  paymentTermsDays: z.number().describe("Payment terms in days, default 15"),
  subtotal: z.number().describe("Sum of all line item amounts"),
  gstAmount: z.number().describe("subtotal × gstPercent / 100"),
  total: z.number().describe("subtotal + gstAmount"),
  invoiceDate: z
    .string()
    .describe(
      'Specific invoice date in YYYY-MM-DD format if mentioned. Return empty string "" if not mentioned.'
    ),
  invoiceMonth: z
    .string()
    .describe(
      'Month this invoice is for e.g. "January 2026". Return empty string "" if not mentioned.'
    ),
  changedFields: z
    .array(z.string())
    .describe(
      "For edit intent only: list of field names that were changed e.g. ['gstPercent', 'lineItems', 'paymentTermsDays']"
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
      "Individual self-contained prompt for each invoice with client name, description, amount, GST, payment terms, and specific month/date if applicable"
    ),
});

export type ParsedInvoice = z.infer<typeof invoiceSchema>;
export type MultiInvoiceDetection = z.infer<typeof multiInvoiceSchema>;

const INVOICE_PROMPT = `You are an expert invoice parser for Indian freelancers and businesses.

Parse the following invoice request and extract ALL invoice details.

CURRENCY RULES:
- Convert ALL amounts to INR (Indian Rupees)
- $1 USD = 84 INR (e.g. $500 = ₹42,000)
- £1 GBP = 106 INR
- €1 EUR = 90 INR
- Rs, INR, ₹ are all already INR — no conversion needed
- "k" format: 10k = 10000, 2.5k = 2500

INTENT RULES:
- "new"  → user wants to create a fresh invoice
- "edit" → user wants to modify an existing invoice (keywords: change, update, edit, modify, add to, remove from, bump, set, make it, increase, decrease)
- "copy" → user wants to duplicate an existing invoice for a new client (keywords: copy, same as, duplicate, like last, like previous)

SESSION CONTEXT (existing invoices in this chat):
{sessionContext}

EDIT RULES (when intent = "edit"):
- Set targetInvoiceRef to the invoice number or client name mentioned
- ONLY include fields in changedFields that the user explicitly asked to change
- If user only says "change GST to 28%", changedFields = ["gstPercent"] ONLY
- If user only says "change payment terms to 30 days", changedFields = ["paymentTermsDays"] ONLY
- If user says "add a line item", changedFields = ["lineItems"] ONLY
- NEVER include lineItems in changedFields unless user explicitly asks to add/remove/change items
- NEVER recalculate or guess line item amounts — return the original line items unchanged unless explicitly asked
- For totals: the system will recalculate subtotal/gstAmount/total automatically based on changedFields
- List ONLY the fields user asked to change in changedFields array

COPY RULES (when intent = "copy"):
- Set targetInvoiceRef to the source invoice number or client name
- Set clientName to the new client name
- Copy all line items, GST, payment terms exactly
- changedFields = ["clientName"]

GENERAL RULES:
- Extract each service/item as a separate line item
- If amount given directly (₹20,000), use quantity=1, rate=that amount
- If GST not mentioned, assume 18%
- If payment terms not mentioned, default to 15 days
- "net 7" or "7 days" = paymentTermsDays 7
- "standard payment terms" = 30 days
- If a specific month mentioned (e.g. "for January"), extract as invoiceMonth "January 2026"
- If a specific date mentioned, extract as invoiceDate in YYYY-MM-DD
- Calculate: subtotal = sum of all line item amounts
- Calculate: gstAmount = subtotal × gstPercent / 100
- Calculate: total = subtotal + gstAmount
- For recurring monthly invoices, always set invoiceDate to the 1st of that invoice month
  e.g. invoiceMonth "May 2026" → invoiceDate "2026-05-01"
  e.g. invoiceMonth "October 2026" → invoiceDate "2026-10-01"
- Never leave invoiceDate empty when invoiceMonth is specified
- If NO month is mentioned in the prompt, ALWAYS use current month and year
- Current month is: {currentMonth}
- NEVER inherit month from session context for new invoices
- Session context is only for edit/copy intents, never for determining invoice month of new invoices

Invoice Request: {prompt}`;

const MULTI_DETECT_PROMPT = `You are an invoice assistant. Analyze if this prompt requests multiple SEPARATE invoices.

MULTIPLE invoices examples:
- "Create 3 invoices for Jan, Feb, March"
- "Bill Rahul for January and February separately"  
- "Create monthly invoices for 6 months"
- "Invoice Rahul for Q1 - January, February, March separately"
- "monthly invoice for Priya ₹15,000/month for 6 months" 

SINGLE invoice examples (even with multiple line items):
- "Invoice Rahul for logo design, brand guidelines and 3 revisions"
- "Bill Priya for development work and bug fixes"
- "Invoice Ankit for design ₹20k and development ₹30k"

RECURRING INVOICE RULES:
1. If prompt mentions SPECIFIC months (e.g. "April, May, June, August"):
   - Use EXACTLY those months in that order
   - Do NOT fill in skipped months (e.g. if July is missing, skip July)
   - count = number of months listed

2. If prompt says "X months" or "for N months" WITHOUT listing them:
   - Generate N consecutive months
   - Start from current month: {currentMonth}
   - count = N

3. Each sub-prompt must be fully self-contained:
   client name, description, amount, GST%, payment terms, and specific month + year
   e.g. "Invoice Priya for web maintenance ₹15,000 with 18% GST for April 2026, payment terms 15 days"

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
  const currentMonth = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const formatted = await promptTemplate.format({ prompt, currentMonth });
  return await structuredModel.invoke(formatted);
}

export async function parseInvoiceWithAI(
  prompt: string,
  sessionContext: string = "No existing invoices in this session."
): Promise<ParsedInvoice> {
  const model = getModel();
  const structuredModel = model.withStructuredOutput(invoiceSchema);
  const promptTemplate = PromptTemplate.fromTemplate(INVOICE_PROMPT);
  const currentMonth = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const formatted = await promptTemplate.format({
    prompt,
    sessionContext,
    currentMonth,
  });
  return await structuredModel.invoke(formatted);
}

export async function parseMultipleInvoices(
  subPrompts: string[]
): Promise<ParsedInvoice[]> {
  return await Promise.all(
    subPrompts.map((p) =>
      parseInvoiceWithAI(p, "No existing invoices in this session.")
    )
  );
}
