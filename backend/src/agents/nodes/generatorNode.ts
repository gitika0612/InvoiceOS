import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { InvoiceAgentState, AgentResult } from "../state";
import { ParsedInvoice, invoiceSchema } from "../schemas/invoiceSchema";
import { INVOICE_PROMPT } from "../prompts/invoicePrompt";
import { findClientMatch } from "../../lib/clientMatcher";
import { recalculateTotals, formatINR } from "../utils/invoiceUtils";
import { buildCurrencyContext } from "../utils/currencyService";

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
  const currencyRates = await buildCurrencyContext();

  const formatted = await template.format({
    prompt: state.prompt,
    sessionContext: state.sessionContext,
    memoryContext: state.memoryContext,
    currentMonth,
    currentDate,
    currencyRates,
  });

  const raw = (await structured.invoke(formatted)) as ParsedInvoice;
  const finalInvoice = recalculateTotals(raw);

  // ── SPLIT INVOICE ──
  if (state.isSplit && state.splitCount > 1) {
    const parts = state.splitCount;
    const baseTotal = finalInvoice.total;
    const amountPerPart = Math.round(baseTotal / parts);

    const invoices: ParsedInvoice[] = Array.from({ length: parts }, (_, i) => {
      const splitItems = finalInvoice.lineItems.map((item) => ({
        ...item,
        rate: Math.round(item.rate / parts),
        amount: Math.round(item.amount / parts),
      }));
      return recalculateTotals({
        ...finalInvoice,
        lineItems: splitItems,
        notes: `Split invoice ${i + 1} of ${parts}${
          finalInvoice.notes ? ` — ${finalInvoice.notes}` : ""
        }`,
      });
    });

    const matchResult = state.userId
      ? await findClientMatch(state.userId, finalInvoice.clientName)
      : { type: "none" as const, client: null, score: 0 };

    const invoicesWithMatch = invoices.map((inv) => ({
      invoice: inv,
      matchResult,
    }));

    return {
      parsedInvoice: finalInvoice,
      parsedInvoices: invoices,
      invoicesWithMatch,
      matchResult,
      agentResult: {
        action: "multi_created",
        message: `Done! Split **${formatINR(
          baseTotal
        )}** into **${parts} equal invoices** of **${formatINR(
          amountPerPart
        )}** each for **${
          finalInvoice.clientName
        }**. Review them in the side panel.`,
        invoices,
        invoicesWithMatch,
        splitDetails: { originalAmount: baseTotal, parts, amountPerPart },
      },
    };
  }

  // ── SINGLE INVOICE ──
  const matchResult = state.userId
    ? await findClientMatch(state.userId, finalInvoice.clientName)
    : { type: "none" as const, client: null, score: 0 };

  const isCreditNote = finalInvoice.notes
    ?.toLowerCase()
    .includes("credit note");
  const isAdvance = finalInvoice.lineItems.some((i) =>
    i.description.toLowerCase().includes("advance")
  );
  const isMilestone = finalInvoice.lineItems.some((i) =>
    i.description.toLowerCase().includes("milestone")
  );
  const isProRata = finalInvoice.lineItems.some((i) =>
    i.description.toLowerCase().includes("pro-rata")
  );

  const typeLabel = isCreditNote
    ? "Credit note"
    : isAdvance
    ? "Advance payment invoice"
    : isMilestone
    ? "Milestone invoice"
    : isProRata
    ? "Pro-rata invoice"
    : "Invoice";

  let action: AgentResult["action"];
  let message: string;

  if (matchResult.type === "exact") {
    action = "created";
    message = `Got it! Using **${
      matchResult.client?.name
    }**'s saved details ✓\n\n${typeLabel} of **${formatINR(
      finalInvoice.total
    )}** ready for **${
      finalInvoice.clientName
    }**. Review it in the side panel.`;
  } else if (matchResult.type === "partial") {
    action = "needs_client";
    message = `I found a saved client named **${matchResult.client?.name}**.\nIs **${finalInvoice.clientName}** the same client? Reply **same** or **different**.`;
  } else {
    action = "needs_client";
    message = `${typeLabel} of **${formatINR(
      finalInvoice.total
    )}** is ready for **${finalInvoice.clientName}**!
  
  To complete it, please share the client’s contact details:
  
  **Email** (required)  
  Optional: Address, City, State, Phone, Tax ID
  
  💡 Example: john.doe@gmail.com, 123 Market St, San Francisco, CA 94103, (415) 555-0123
  
  Or type **skip** to continue without adding details.`;
  }

  return {
    parsedInvoice: finalInvoice,
    matchResult,
    agentResult: { action, message, invoice: finalInvoice, matchResult },
  };
}
