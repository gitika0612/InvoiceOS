import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { InvoiceAgentState } from "../state";
import { invoiceSchema } from "../schemas/invoiceSchema";
import { INVOICE_PROMPT } from "../prompts/invoicePrompt";

function buildEditSessionContext(state: InvoiceAgentState): string {
  const baseContext =
    state.sessionContext || "No existing invoices in this session.";

  // Try to use most recent parsed invoice if available
  const invoice = state.parsedInvoice;

  if (!invoice) {
    return baseContext;
  }

  const lineItems = invoice.lineItems
    .map(
      (item, index) =>
        `${index + 1}. ${item.description} | Qty: ${item.quantity} | Unit: ${
          item.unit
        } | Rate: ₹${item.rate} | Amount: ₹${item.amount}`
    )
    .join("\n");

  return `
${baseContext}

Current invoice being edited:
Client: ${invoice.clientName}
Invoice Month: ${invoice.invoiceMonth}
Invoice Date: ${invoice.invoiceDate}
Line Items:${lineItems}
GST: ${invoice.gstPercent}% ${invoice.gstType}
Discount Type: ${invoice.discountType}
Discount Value: ${invoice.discountValue}
Payment Terms: ${invoice.paymentTermsDays} days
Subtotal: ₹${invoice.subtotal}
Total: ₹${invoice.total}
`;
}

export async function editorNode(
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

  const editSessionContext = buildEditSessionContext(state);

  const formatted = await template.format({
    prompt: state.prompt,
    sessionContext: editSessionContext,
    memoryContext: state.memoryContext,
    currentMonth,
    currentDate,
  });

  const parsedInvoice = await structured.invoke(formatted);

  return {
    parsedInvoice,
    responseMessage: `Got it! I'll update the invoice as requested.`,
  };
}
