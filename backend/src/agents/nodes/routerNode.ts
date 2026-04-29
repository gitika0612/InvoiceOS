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

"new" = create a FRESH invoice. Use when:
  - "Invoice X for ₹Y" — any prompt that states an amount and a client name
  - "Invoice Priya ₹50,000 no GST" → NEW (even if Priya already has an invoice in session)
  - "Bill Rahul for logo design" → NEW
  - "Invoice Priya again" → NEW (new invoice using her history)
  - "₹1,00,000 — 40% design, 60% development" → NEW invoice with 2 line items (NOT split)
  - Percentage split like "40% X, 60% Y" is ALWAYS "new" with multiple line items
  - CRITICAL: If the prompt contains a client name + amount/service description with NO edit keywords, it is ALWAYS "new", regardless of whether that client already has an invoice in the session.

"edit" = modify an EXISTING invoice in session. Use ONLY when ALL of these are true:
  (a) The prompt contains an explicit edit keyword: add / remove / replace / change / update / set / increase / decrease / apply / put / delete / swap
  (b) The edit keyword clearly refers to modifying an existing invoice, NOT creating a new one
  Examples:
  - "add hosting fees to last invoice" → edit
  - "add GST to INV-2026-001" → edit
  - "remove logo design from Rahul's invoice" → edit
  - "change payment terms to 30 days in last invoice" → edit
  - "add late fee to INV-2026-001" → edit
  - "in last invoice" + any modification = ALWAYS edit
  - "in INV-XXX" + any modification = ALWAYS edit
  IMPORTANT: "Invoice Priya ₹50,000" has NO edit keywords → it is "new", not "edit"
  IMPORTANT: "Invoice Priya again for ₹50,000" → "new" (again = repeat, not edit)

"copy" = duplicate existing invoice for a DIFFERENT client. Use when:
  - "same invoice for X"
  - "copy [client]'s invoice for [other client]"
  - "same as last one but for [client]"
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

DISAMBIGUATION EXAMPLES:
"Invoice Priya ₹50,000 no GST" → new (client name + amount = fresh invoice)
"Invoice Rahul ₹1,00,000 — 40% design, 60% development" → new (single invoice, 2 line items)
"Add hosting fees in last invoice" → edit, targetRef = last invoice client/number
"Split Ankit's invoice into 2 parts" → split
"Create 3 invoices for Jan, Feb, March" → multi, estimatedCount=3
"Same invoice as last one but for Ankit" → copy
"Copy Rahul's invoice for Priya" → copy, targetRef = "Rahul"
"Invoice Priya again for ₹50,000 no GST" → new`
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
