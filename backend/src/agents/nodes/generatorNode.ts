import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { InvoiceAgentState } from "../state";
import { invoiceSchema } from "../schemas/invoiceSchema";
import { INVOICE_PROMPT } from "../prompts/invoicePrompt";
import { findClientMatch } from "../../lib/clientMatcher";

export async function generatorNode(
  state: InvoiceAgentState
): Promise<Partial<InvoiceAgentState>> {
  const model = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const structured = model.withStructuredOutput(invoiceSchema);
  const template = PromptTemplate.fromTemplate(INVOICE_PROMPT);

  const currentMonth = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const currentDate = new Date().toISOString().split("T")[0];

  const formatted = await template.format({
    prompt: state.prompt,
    sessionContext: state.sessionContext,
    memoryContext: state.memoryContext,
    currentMonth,
    currentDate,
  });

  const parsedInvoice = await structured.invoke(formatted);

  // ── Find client match ──
  const matchResult = state.userId
    ? await findClientMatch(state.userId, parsedInvoice.clientName)
    : { type: "none" as const, client: null, score: 0 };

  return {
    parsedInvoice,
    matchResult,
    responseMessage: `Here's the invoice for **${parsedInvoice.clientName}**. Review it in the panel on the right.`,
  };
}
