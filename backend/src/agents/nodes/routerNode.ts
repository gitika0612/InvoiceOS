import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { InvoiceAgentState, AgentIntent } from "../state";

const routerSchema = z.object({
  intent: z.enum(["new", "edit", "copy", "multi", "split", "unclear"]),
  isMultiple: z.boolean(),
  targetRef: z.string(),
  estimatedCount: z.number(),
  notes: z.string(),
});

export async function routerNode(
  state: InvoiceAgentState
): Promise<Partial<InvoiceAgentState>> {
  const model = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const structured = model.withStructuredOutput(routerSchema);

  const result = await structured.invoke(
    `You are routing an invoice request. Be precise.

Session context (existing invoices):
${state.sessionContext}

User prompt: "${state.prompt}"

ROUTING RULES — read carefully:

"new" = create a fresh invoice. Use when:
  - "Invoice X for ₹Y" with no reference to existing invoice
  - "Invoice Priya again" (new invoice using her history)
  - "₹1,00,000 — 40% design, 60% development" → NEW invoice with 2 line items (NOT split)
  - Percentage split like "40% X, 60% Y" is ALWAYS "new" with multiple line items

"edit" = modify an EXISTING invoice in session. Use when ANY of these appear:
  - "add [item] to [invoice/last invoice]"
  - "add [item] in last invoice" 
  - "add [item] to INV-XXX"
  - "remove [item] from [invoice]"
  - "replace [item] in [invoice]"
  - "add GST to INV-XXX"
  - "add late fee to [invoice]"
  - "change [field] in [invoice]"
  - "in last invoice" + any modification = ALWAYS edit
  - "in INV-XXX" + any modification = ALWAYS edit
  - IMPORTANT: "add hosting fees in last invoice" = edit (not new)

"copy" = duplicate existing invoice for a DIFFERENT client. Use when:
  - "same invoice for X" 
  - "copy [client]'s invoice for [other client]"
  - "same as last one but for [client]"
  - IMPORTANT: "same as last one but for Ankit" when Ankit has his OWN invoices
    → still copy the most recent invoice that is NOT Ankit's
  - targetRef = source client name or invoice number

"multi" = multiple SEPARATE invoices for different months. Use when:
  - "for Jan, Feb, March" (specific months listed)
  - "for 6 months" / "monthly for N months"
  - "3 invoices"
  - estimatedCount = number of invoices

"split" = divide ONE invoice total into N equal parts. Use when:
  - "split [client]'s invoice into N parts"
  - "divide into N equal invoices"
  - NOT for percentage splits like "40% design, 60% development" (that's "new")

EXAMPLES:
"Add hosting fees in last invoice" → edit, targetRef = last invoice client/number
"Invoice Rahul ₹1,00,000 — 40% design, 60% development" → new (single invoice, 2 line items)
"Split Ankit's invoice into 2 parts" → split
"Create 3 invoices for Jan, Feb, March" → multi, estimatedCount=3
"Same invoice as last one but for Ankit" → copy
"Copy Rahul's invoice for Priya" → copy, targetRef = "Rahul"`
  );

  let intent = result.intent as AgentIntent;
  const isSplit = intent === "split";
  if (isSplit) intent = "new";

  return {
    intent,
    isMultiple: result.isMultiple || (result.estimatedCount > 1 && !isSplit),
    isSplit,
    splitCount: isSplit ? result.estimatedCount : 1,
    targetRef: result.targetRef || "",
    routerNotes: result.notes,
  };
}
