import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { InvoiceAgentState } from "../state";
import { invoiceSchema, multiInvoiceSchema } from "../schemas/invoiceSchema";
import { INVOICE_PROMPT } from "../prompts/invoicePrompt";
import { MULTI_DETECT_PROMPT } from "../prompts/multiDetectPrompt";
import { findClientMatch } from "../../lib/clientMatcher";

export async function multiInvoiceNode(
  state: InvoiceAgentState
): Promise<Partial<InvoiceAgentState>> {
  const model = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const currentMonth = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const currentDate = new Date().toISOString().split("T")[0];

  // ── Step 1: Detect sub-prompts ──
  const multiStructured = model.withStructuredOutput(multiInvoiceSchema);
  const multiTemplate = PromptTemplate.fromTemplate(MULTI_DETECT_PROMPT);
  const multiFormatted = await multiTemplate.format({
    prompt: state.prompt,
    currentMonth,
    currentDate,
  });
  const detection = await multiStructured.invoke(multiFormatted);

  if (!detection.isMultiple || detection.subPrompts.length <= 1) {
    // Fall back to single invoice generation
    return { isMultiple: false };
  }

  // ── Step 2: Parse each sub-prompt sequentially ──
  const invoiceStructured = model.withStructuredOutput(invoiceSchema);
  const invoiceTemplate = PromptTemplate.fromTemplate(INVOICE_PROMPT);

  const parsedInvoices = [];
  for (const subPrompt of detection.subPrompts) {
    const formatted = await invoiceTemplate.format({
      prompt: subPrompt,
      sessionContext: "No existing invoices in this session.",
      memoryContext: state.memoryContext,
      currentMonth,
      currentDate,
    });
    const invoice = await invoiceStructured.invoke(formatted);
    parsedInvoices.push(invoice);
  }

  // ── Step 3: Find client match for each ──
  const invoicesWithMatch = await Promise.all(
    parsedInvoices.map(async (invoice) => {
      const matchResult = state.userId
        ? await findClientMatch(state.userId, invoice.clientName)
        : { type: "none" as const, client: null, score: 0 };
      return { invoice, matchResult };
    })
  );

  return {
    isMultiple: true,
    parsedInvoices,
    invoicesWithMatch,
    responseMessage: `I've prepared **${parsedInvoices.length} invoices**! Review each one in the panel.`,
  };
}
