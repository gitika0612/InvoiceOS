import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { InvoiceAgentState, AgentResult } from "../state";
import {
  ParsedInvoice,
  invoiceSchema,
  multiInvoiceSchema,
} from "../schemas/invoiceSchema";
import { INVOICE_PROMPT } from "../prompts/invoicePrompt";
import { MULTI_DETECT_PROMPT } from "../prompts/multiDetectPrompt";
import { findClientMatch } from "../../lib/clientMatcher";
import { buildCurrencyContext } from "../utils/currencyService";
import { recalculateTotals } from "../utils/invoiceUtils";

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
  const currencyRates = await buildCurrencyContext();

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
    // Fall back to single invoice via generator
    return { isMultiple: false };
  }

  // ── Step 2: Parse each sub-prompt ──
  const invoiceStructured = model.withStructuredOutput(invoiceSchema);
  const invoiceTemplate = PromptTemplate.fromTemplate(INVOICE_PROMPT);

  const parsedInvoices: ParsedInvoice[] = [];
  for (const subPrompt of detection.subPrompts) {
    const formatted = await invoiceTemplate.format({
      prompt: subPrompt,
      sessionContext: "No existing invoices in this session.",
      memoryContext: state.memoryContext,
      currentMonth,
      currentDate,
      currencyRates,
    });
    const raw = (await invoiceStructured.invoke(formatted)) as ParsedInvoice;
    parsedInvoices.push(recalculateTotals(raw));
  }

  // ── Step 3: Find client matches ──
  const invoicesWithMatch = await Promise.all(
    parsedInvoices.map(async (invoice) => {
      const matchResult = state.userId
        ? await findClientMatch(state.userId, invoice.clientName)
        : { type: "none" as const, client: null, score: 0 };
      return { invoice, matchResult };
    })
  );

  // ── Step 4: Build contextual message ──
  const clientName = parsedInvoices[0]?.clientName || "client";
  const months = parsedInvoices
    .map((inv) => inv.invoiceMonth)
    .filter(Boolean)
    .join(", ");
  const totalSum = parsedInvoices.reduce((sum, inv) => sum + inv.total, 0);

  const result: AgentResult = {
    action: "multi_created",
    message: `Done! Prepared **${
      parsedInvoices.length
    } invoices** for **${clientName}**${
      months ? ` (${months})` : ""
    }.\n\nTotal value: **₹${totalSum.toLocaleString(
      "en-IN"
    )}**\n\nReview each invoice in the side panel.`,
    invoices: parsedInvoices,
    invoicesWithMatch,
  };

  return {
    isMultiple: true,
    parsedInvoices,
    invoicesWithMatch,
    agentResult: result,
    responseMessage: result.message,
  };
}
