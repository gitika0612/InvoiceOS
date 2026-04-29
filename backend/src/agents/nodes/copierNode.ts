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

async function fetchLastConfirmedInvoice(userId: string): Promise<string> {
  try {
    const last = await Invoice.findOne({ userId, status: "confirmed" })
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
GST Amount: ₹${last.gstAmount}
Payment Terms: ${last.paymentTermsDays} days
Subtotal: ₹${last.subtotal} | Total: ₹${last.total}
Line Items:\n${items}`;
  } catch {
    return "";
  }
}

function findSourceBlock(sessionContext: string, ref: string): string | null {
  if (
    !sessionContext ||
    sessionContext === "No existing invoices in this session."
  )
    return null;
  const lower = ref.toLowerCase().trim();
  const blocks = sessionContext.split("---").filter((b) => b.trim());

  const matching: string[] = [];

  for (const block of blocks) {
    const clientMatch = block.match(/Client:\s*(.+)/i);
    const invRefMatch = block.match(/Invoice Ref:\s*(.+)/i);
    if (!clientMatch) continue;
    const cn = clientMatch[1].trim().toLowerCase();
    const invRef =
      invRefMatch?.[1]
        ?.trim()
        .replace(/\s*\[MOST RECENT\]/i, "")
        .toLowerCase() ?? "";

    // Match by exact invoice number
    if (lower && invRef === lower) {
      matching.push(block.trim());
      continue;
    }
    // Match by client name (exact only to avoid false positives)
    if (lower && cn === lower) {
      matching.push(block.trim());
    }
  }

  // Return most recent match (last in array = most recently created)
  if (matching.length > 0) return matching[matching.length - 1];

  // Fallback: if ref is empty or "last", return the last block (most recent)
  if (!lower || lower === "last" || lower === "last one") {
    return blocks.length > 0 ? blocks[blocks.length - 1].trim() : null;
  }

  return null;
}

function buildCopySessionContext(sourceBlock: string): string {
  return `SOURCE INVOICE TO COPY (use ALL values EXACTLY as shown below):
---
${sourceBlock}
---

COPY RULES (CRITICAL):
- Copy the clientName, lineItems, gstPercent, gstType, paymentTermsDays EXACTLY from above
- Change only the clientName to the NEW client specified in the prompt
- If GST% is 0 above → set gstPercent=0, gstAmount=0, total=subtotal
- If GST% is 18 above → keep 18%
- Do NOT invent or change any amounts
- Generate fresh invoiceDate = today, invoiceMonth = current month`;
}

export async function copierNode(
  state: InvoiceAgentState
): Promise<Partial<InvoiceAgentState>> {
  const ref = state.targetRef || "";
  const hasSessionInvoices =
    state.sessionContext &&
    state.sessionContext !== "No existing invoices in this session.";

  // Multiple session matches → ask which one to copy
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

  const promptLower = state.prompt.toLowerCase();
  const isCrossSession =
    !hasSessionInvoices &&
    (promptLower.includes("same as last") ||
      promptLower.includes("last one") ||
      promptLower.includes("like last time") ||
      promptLower.includes("previous invoice"));

  let effectiveSessionContext = state.sessionContext;

  if (isCrossSession) {
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
  } else {
    const sourceBlock = findSourceBlock(state.sessionContext, ref || "last");
    if (sourceBlock) {
      effectiveSessionContext = buildCopySessionContext(sourceBlock);
    }
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
