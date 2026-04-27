import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { InvoiceAgentState, AgentResult } from "../state";
import { ParsedInvoice, invoiceSchema } from "../schemas/invoiceSchema";
import { INVOICE_PROMPT } from "../prompts/invoicePrompt";
import { buildCurrencyContext } from "../utils/currencyService";
import {
  recalculateTotals,
  diffLineItems,
  formatINR,
} from "../utils/invoiceUtils";

const FIELD_LABELS: Record<string, string> = {
  clientName: "client name",
  gstPercent: "GST rate",
  gstType: "GST type",
  paymentTermsDays: "payment terms",
  invoiceDate: "invoice date",
  invoiceMonth: "invoice month",
  discountType: "discount",
  discountValue: "discount value",
  notes: "notes",
};

function buildEditContext(state: InvoiceAgentState): string {
  const base = state.sessionContext || "No existing invoices in this session.";
  const inv = state.parsedInvoice;
  if (!inv) return base;

  const items = inv.lineItems
    .map(
      (item, i) =>
        `${i + 1}. "${item.description}" | Qty: ${item.quantity} ${
          item.unit
        } | Rate: ₹${item.rate} | Amount: ₹${item.amount}`
    )
    .join("\n");

  return `${base}

CURRENT INVOICE BEING EDITED (use these exact line items as the base):
Client: ${inv.clientName}
Invoice Month: ${inv.invoiceMonth}
GST: ${inv.gstPercent}% ${inv.gstType}
Discount: ${inv.discountType} ${inv.discountValue}
Payment Terms: ${inv.paymentTermsDays} days
Subtotal: ₹${inv.subtotal}
Total: ₹${inv.total}
Line Items:
${items}`;
}

function isAddOperation(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const hasAdd =
    /\badd\b/.test(lower) ||
    /\bappend\b/.test(lower) ||
    /\binclude\b/.test(lower);
  const hasRemoveOrReplace =
    /\bremove\b/.test(lower) ||
    /\breplace\b/.test(lower) ||
    /\bdelete\b/.test(lower) ||
    /\bswap\b/.test(lower);
  return hasAdd && !hasRemoveOrReplace;
}

function applyNonLineItemChanges(
  existing: ParsedInvoice,
  parsed: ParsedInvoice,
  changedFields: string[]
): ParsedInvoice {
  const updated = { ...existing };
  if (changedFields.includes("clientName"))
    updated.clientName = parsed.clientName;
  if (changedFields.includes("gstPercent"))
    updated.gstPercent = parsed.gstPercent;
  if (changedFields.includes("gstType")) updated.gstType = parsed.gstType;
  if (changedFields.includes("paymentTermsDays"))
    updated.paymentTermsDays = parsed.paymentTermsDays;
  if (changedFields.includes("invoiceDate"))
    updated.invoiceDate = parsed.invoiceDate;
  if (changedFields.includes("invoiceMonth"))
    updated.invoiceMonth = parsed.invoiceMonth;
  if (changedFields.includes("discountType"))
    updated.discountType = parsed.discountType;
  if (changedFields.includes("discountValue"))
    updated.discountValue = parsed.discountValue;
  if (changedFields.includes("notes")) updated.notes = parsed.notes;
  return updated;
}

function buildEditMessage(
  invoice: ParsedInvoice,
  ref: string,
  changeParts: string[],
  warning: string
): string {
  const nameRef =
    ref && ref !== invoice.clientName
      ? `**${invoice.clientName}**'s invoice (${ref})`
      : `**${invoice.clientName}**'s invoice`;

  const parts = [
    `Updated ${nameRef}.`,
    changeParts.filter(Boolean).join(" · "),
    `New total: **${formatINR(invoice.total)}**`,
    `Review the updated invoice in the side panel.`,
    warning ? `⚠️ ${warning}` : "",
  ].filter(Boolean);

  return parts.join("\n\n");
}

export async function editorNode(
  state: InvoiceAgentState
): Promise<Partial<InvoiceAgentState>> {
  const ref = state.targetRef || "";

  // No invoices in session — can't edit
  if (
    !state.sessionContext ||
    state.sessionContext === "No existing invoices in this session."
  ) {
    return {
      agentResult: {
        action: "not_found",
        message: `I couldn't find any invoices in this session to edit. Please create an invoice first, then ask me to edit it.`,
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
    sessionContext: buildEditContext(state),
    memoryContext: state.memoryContext,
    currentMonth,
    currentDate,
    currencyRates,
  });

  const parsedEdit = (await structured.invoke(formatted)) as ParsedInvoice;
  const changedFields: string[] = parsedEdit.changedFields ?? [];
  const warning: string = parsedEdit.warning ?? "";

  // ── Case 1: Existing invoice in state — apply diff precisely ──
  if (state.parsedInvoice) {
    const existing = state.parsedInvoice;

    if (changedFields.includes("lineItems")) {
      if (isAddOperation(state.prompt)) {
        // ADD: merge new items into existing, never remove
        const existingKeys = new Set(
          existing.lineItems.map((i) => i.description.toLowerCase().trim())
        );
        const newItems = parsedEdit.lineItems
          .filter((i) => !existingKeys.has(i.description.toLowerCase().trim()))
          .map((item) => ({ ...item, amount: item.quantity * item.rate }));

        if (newItems.length === 0) {
          return {
            agentResult: {
              action: "edited",
              message: `⚠️ Couldn't identify what to add to **${existing.clientName}**'s invoice. Please be more specific about the item name and amount.`,
              targetRef: ref,
              changedFields: [],
            },
            parsedInvoice: existing,
          };
        }

        const updated = recalculateTotals({
          ...existing,
          lineItems: [...existing.lineItems, ...newItems],
        });

        return {
          parsedInvoice: updated,
          agentResult: {
            action: "edited",
            message: `Updated **${
              existing.clientName
            }**'s invoice.\n\nAdded ${newItems
              .map((i) => `**${i.description}**`)
              .join(", ")}\nNew total: **${formatINR(
              updated.total
            )}**\n\nReview the updated invoice in the side panel.`,
            invoice: updated,
            targetRef: ref,
            changedFields,
          },
        };
      }

      // REPLACE or REMOVE: diff the arrays
      const candidateItems = parsedEdit.lineItems.map((item) => ({
        ...item,
        amount: item.quantity * item.rate,
      }));
      const diff = diffLineItems(existing.lineItems, candidateItems);

      if (!diff.hasRealChange) {
        const existingList = existing.lineItems
          .map((i) => `**${i.description}**`)
          .join(", ");
        return {
          agentResult: {
            action: "edited",
            message: `⚠️ Couldn't find that item in **${existing.clientName}**'s invoice — nothing was changed.\n\nCurrent items: ${existingList}`,
            targetRef: ref,
            changedFields: [],
            warning: "Requested line item not found",
          },
          parsedInvoice: existing,
        };
      }

      const base = applyNonLineItemChanges(existing, parsedEdit, changedFields);
      const updated = recalculateTotals({ ...base, lineItems: candidateItems });
      const otherChanges = changedFields
        .filter((f) => f !== "lineItems")
        .map((f) => FIELD_LABELS[f] || f);
      const changeParts = [
        diff.summary,
        otherChanges.length > 0 ? `Updated ${otherChanges.join(", ")}` : "",
      ];

      return {
        parsedInvoice: updated,
        agentResult: {
          action: "edited",
          message: buildEditMessage(updated, ref, changeParts, warning),
          invoice: updated,
          targetRef: ref,
          changedFields,
          warning,
        },
      };
    }

    // Non-lineItem changes (GST, terms, discount, date, notes)
    if (changedFields.length > 0) {
      const updated = recalculateTotals(
        applyNonLineItemChanges(existing, parsedEdit, changedFields)
      );
      const labels = changedFields.map((f) => FIELD_LABELS[f] || f);

      return {
        parsedInvoice: updated,
        agentResult: {
          action: "edited",
          message: buildEditMessage(
            updated,
            ref,
            [`Updated ${labels.join(", ")}`],
            warning
          ),
          invoice: updated,
          targetRef: ref,
          changedFields,
        },
      };
    }

    // Nothing changed
    return {
      agentResult: {
        action: "edited",
        message: `Nothing was changed on **${existing.clientName}**'s invoice. Try being more specific — e.g. "Add 18% GST", "Remove the hosting item", or "Change payment terms to 30 days".`,
        targetRef: ref,
        changedFields: [],
      },
      parsedInvoice: existing,
    };
  }

  // ── Case 2: No existing invoice in state — return AI result as-is ──
  // Frontend will match by targetRef from session invoices
  const finalInvoice = recalculateTotals(parsedEdit);
  const labels = changedFields.map((f) => FIELD_LABELS[f] || f).filter(Boolean);

  return {
    parsedInvoice: finalInvoice,
    agentResult: {
      action: "edited",
      message: buildEditMessage(
        finalInvoice,
        ref,
        labels.length > 0 ? [`Updated ${labels.join(", ")}`] : [],
        warning
      ),
      invoice: finalInvoice,
      targetRef: ref,
      changedFields,
      warning,
    },
  };
}
