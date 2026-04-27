import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { InvoiceAgentState, AgentResult } from "../state";
import { ParsedInvoice, invoiceSchema } from "../schemas/invoiceSchema";
import { INVOICE_PROMPT } from "../prompts/invoicePrompt";
import { findClientMatch } from "../../lib/clientMatcher";
import { recalculateTotals } from "../utils/invoiceUtils";
import { buildCurrencyContext } from "../utils/currencyService";
import { Invoice } from "../../models/Invoice";

function parseSessionInvoices(sessionContext: string) {
  if (
    !sessionContext ||
    sessionContext === "No existing invoices in this session."
  )
    return [];
  const invoices: Array<{
    ref: string;
    clientName: string;
    total: string;
    month: string;
  }> = [];
  for (const block of sessionContext.split("---").filter((b) => b.trim())) {
    const clientMatch = block.match(/Client:\s*(.+)/);
    if (clientMatch) {
      invoices.push({
        ref: block.match(/Invoice Ref:\s*(.+)/)?.[1]?.trim() ?? "",
        clientName: clientMatch[1].trim(),
        total: block.match(/Total:\s*₹?([\d,]+)/)?.[1]?.trim() ?? "0",
        month: block.match(/Invoice Month:\s*(.+)/)?.[1]?.trim() ?? "",
      });
    }
  }
  return invoices;
}

function findClientInSession(sessionContext: string, ref: string) {
  const lower = ref.toLowerCase().trim();
  return parseSessionInvoices(sessionContext).filter(
    (inv) =>
      inv.clientName.toLowerCase().includes(lower) ||
      lower.includes(inv.clientName.toLowerCase()) ||
      inv.ref.toLowerCase() === lower
  );
}

// Cross-session: fetch most recent confirmed invoice from DB (no client exclusion)
async function fetchLastConfirmedInvoice(userId: string): Promise<string> {
  try {
    const last = await Invoice.findOne({ userId, isConfirmed: true })
      .sort({ createdAt: -1 })
      .lean();

    if (!last) return "";

    const items = last.lineItems
      .map(
        (i) =>
          `${i.description} | Qty: ${i.quantity} | Rate: ₹${i.rate} | Amount: ₹${i.amount}`
      )
      .join("\n");

    return `Most recent confirmed invoice from database:
Client: ${last.clientName}
Invoice Month: ${last.invoiceMonth}
GST: ${last.gstPercent}% ${last.gstType}
Payment Terms: ${last.paymentTermsDays} days
Subtotal: ₹${last.subtotal} | Total: ₹${last.total}
Line Items:
${items}`;
  } catch {
    return "";
  }
}

export async function copierNode(
  state: InvoiceAgentState
): Promise<Partial<InvoiceAgentState>> {
  const ref = state.targetRef || "";
  const hasSessionInvoices =
    state.sessionContext &&
    state.sessionContext !== "No existing invoices in this session.";

  // Bug 4: multiple session matches for source client → ask which one to copy
  if (ref && hasSessionInvoices) {
    const matches = findClientInSession(state.sessionContext, ref);
    if (matches.length > 1) {
      const list = matches
        .map(
          (m) =>
            `• **${m.ref || "Draft"}** — ${m.month || "unknown"} — ₹${m.total}`
        )
        .join("\n");
      return {
        agentResult: {
          action: "ambiguous",
          message: `Found **${matches.length} invoices** for **${ref}**:\n\n${list}\n\nWhich one should I copy? Reply with the invoice number (e.g. **INV-2026-155**).`,
          targetRef: ref,
        },
      };
    }
  }

  // Bug 3: no session invoices + cross-session keywords → fetch from DB
  const promptLower = state.prompt.toLowerCase();
  const isCrossSession =
    !hasSessionInvoices &&
    (promptLower.includes("same as last") ||
      promptLower.includes("last one") ||
      promptLower.includes("like last time") ||
      promptLower.includes("previous invoice"));

  let effectiveSessionContext = state.sessionContext;

  if (isCrossSession) {
    // Fetch the most recent confirmed invoice from DB — no exclusion by client name.
    // If the last invoice was for Ankit, we copy it. That's the correct behavior:
    // user said "same as last one but for [someone]" and last = Ankit's → copy Ankit's for the new client.
    const dbContext = await fetchLastConfirmedInvoice(state.userId);
    if (!dbContext) {
      return {
        agentResult: {
          action: "not_found",
          message: `I couldn't find any previous confirmed invoices to copy. Please create and confirm an invoice first.`,
        },
      };
    }
    effectiveSessionContext = `No existing invoices in this chat session.\n\nYour most recent invoice from history:\n${dbContext}`;
  } else if (!hasSessionInvoices) {
    return {
      agentResult: {
        action: "not_found",
        message: `I couldn't find any invoices in this session to copy. Please create an invoice first.`,
      },
    };
  }

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
    sessionContext: effectiveSessionContext,
    memoryContext: state.memoryContext,
    currentMonth,
    currentDate,
    currencyRates,
  });

  const raw = (await structured.invoke(formatted)) as ParsedInvoice;
  const parsedInvoice = recalculateTotals(raw);

  const matchResult = state.userId
    ? await findClientMatch(state.userId, parsedInvoice.clientName)
    : { type: "none" as const, client: null, score: 0 };

  let action: AgentResult["action"];
  let message: string;

  if (matchResult.type === "exact") {
    action = "copied";
    message = `Copied invoice for **${
      parsedInvoice.clientName
    }** ✓\n\nUsing their saved details. Total: **₹${parsedInvoice.total.toLocaleString(
      "en-IN"
    )}** — review it in the side panel.`;
  } else if (matchResult.type === "partial") {
    action = "needs_client";
    message = `I found a saved client named **${matchResult.client?.name}**.\nIs **${parsedInvoice.clientName}** the same client? Reply **same** or **different**.`;
  } else {
    action = "needs_client";
    message = `Copied invoice for **${
      parsedInvoice.clientName
    }**!\n\nTotal: **₹${parsedInvoice.total.toLocaleString(
      "en-IN"
    )}**\n\nPlease share their contact details:\n\n**Email** *(required)*\n*(Optional: Address, City, State, Phone, GSTIN)*\n\nOr say **skip**.`;
  }

  return {
    parsedInvoice,
    matchResult,
    agentResult: {
      action,
      message,
      invoice: parsedInvoice,
      matchResult,
      targetRef: ref,
    },
  };
}
