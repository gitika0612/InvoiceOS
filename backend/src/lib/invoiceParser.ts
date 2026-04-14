/// <reference types="node" />
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
});

export type LineItem = z.infer<typeof lineItemSchema>;
export type ParsedInvoice = z.infer<typeof invoiceSchema>;

// The prompt that instructs the AI how to parse
const INVOICE_PROMPT = `You are an expert invoice parser for Indian freelancers.

Parse the invoice request and extract ALL line items separately.
Each service/item mentioned should be its own line item.
Calculate amounts correctly.
If payment terms are mentioned extract them, otherwise default to 15 days.
If GST not mentioned, assume 18%.
Convert "k" format to full numbers (10k = 10000).
Return all amounts as plain numbers without symbols.

Invoice Request: {prompt}

Extract complete invoice details with all line items.`;

export async function parseInvoiceWithAI(
  prompt: string
): Promise<ParsedInvoice> {
  const model = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const structuredModel = model.withStructuredOutput(invoiceSchema);
  const promptTemplate = PromptTemplate.fromTemplate(INVOICE_PROMPT);
  const formattedPrompt = await promptTemplate.format({ prompt });
  const result = await structuredModel.invoke(formattedPrompt);

  return result;
}
