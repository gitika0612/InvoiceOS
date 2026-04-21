import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { InvoiceAgentState } from "../state";
import { invoiceSchema } from "../schemas/invoiceSchema";
import { INVOICE_PROMPT } from "../prompts/invoicePrompt";

export async function copierNode(
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

  return {
    parsedInvoice,
    responseMessage: `Copying invoice for **${parsedInvoice.clientName}**...`,
  };
}
