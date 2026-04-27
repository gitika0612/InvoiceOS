import { InvoiceAgentState } from "../state";
import { findSimilarInvoices, invoiceToText } from "../../lib/embeddingService";
import { Invoice } from "../../models/Invoice";
import { IInvoiceDocument } from "../../models/Invoice";

function buildMemoryContext(
  invoices: IInvoiceDocument[],
  prompt: string
): string {
  if (invoices.length === 0) return "No past invoice history for this client.";

  const lower = prompt.toLowerCase();
  const isSameWork =
    lower.includes("same work") ||
    lower.includes("same as last") ||
    lower.includes("like last time") ||
    lower.includes("again") ||
    lower.includes("repeat") ||
    lower.includes("previous");

  if (isSameWork) {
    // Bug 6 & 7 fix: for "same work" / "like last time" prompts,
    // use ONLY the most recent invoice — don't concat all history
    const latest = invoices[0]; // already sorted by createdAt desc
    const items = latest.lineItems
      .map((item) => `${item.description} (₹${item.rate}/${item.unit})`)
      .join(", ");

    return (
      `Most recent invoice for this client [${
        latest.invoiceMonth || "unknown month"
      }]:\n` +
      `Items: ${items}\n` +
      `GST: ${latest.gstPercent}% ${latest.gstType}\n` +
      `Terms: ${latest.paymentTermsDays} days\n` +
      `Total: ₹${latest.total.toLocaleString("en-IN")}\n` +
      `Use EXACTLY these line items, rates, GST, and payment terms for the new invoice.`
    );
  }

  // For regular new invoices, show last 3 for rate reference (not all)
  const recent = invoices.slice(0, 3);
  const lines = recent.map((inv, i) => {
    const items = inv.lineItems
      .map((item) => `${item.description} (₹${item.rate}/${item.unit})`)
      .join(", ");
    return (
      `Invoice ${i + 1} [${inv.invoiceMonth || "unknown month"}]: ` +
      `Items: ${items} | ` +
      `GST: ${inv.gstPercent}% ${inv.gstType} | ` +
      `Terms: ${inv.paymentTermsDays} days | ` +
      `Total: ₹${inv.total.toLocaleString("en-IN")}`
    );
  });

  // Most recent rates for each unique item
  const mostRecentRates: Record<string, number> = {};
  for (const inv of recent) {
    for (const item of inv.lineItems) {
      if (!mostRecentRates[item.description]) {
        mostRecentRates[item.description] = item.rate;
      }
    }
  }
  const rateHints = Object.entries(mostRecentRates)
    .map(([desc, rate]) => `${desc}: ₹${rate}`)
    .join(", ");

  return [
    `Past ${recent.length} invoice(s) for this client:`,
    ...lines,
    `Most recent rates: ${rateHints}`,
    `Use these as DEFAULT rates when creating new invoice for this client.`,
  ].join("\n");
}

export async function ragNode(
  state: InvoiceAgentState
): Promise<Partial<InvoiceAgentState>> {
  if (state.intent === "edit" || state.intent === "copy") {
    return { memoryContext: "No past invoice history for this client." };
  }

  try {
    const queryText = state.prompt;

    let pastInvoices = await findSimilarInvoices(
      state.userId,
      queryText,
      undefined,
      5
    );

    if (pastInvoices.length === 0) {
      const words = state.prompt.split(" ");
      const commonWords = new Set([
        "invoice",
        "bill",
        "create",
        "make",
        "generate",
        "for",
        "to",
        "the",
        "a",
        "an",
        "with",
        "and",
        "or",
        "gst",
        "monthly",
        "again",
        "another",
        "same",
        "like",
        "last",
        "time",
        "send",
        "new",
      ]);
      const possibleClientName = words.find(
        (w) =>
          w.length > 2 && !commonWords.has(w.toLowerCase()) && /^[A-Z]/.test(w)
      );

      if (possibleClientName) {
        const fallback = await Invoice.find({
          userId: state.userId,
          clientName: { $regex: new RegExp(possibleClientName, "i") },
        })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean();
        pastInvoices = fallback as any;
      }
    }

    const memoryContext = buildMemoryContext(
      pastInvoices as IInvoiceDocument[],
      state.prompt
    );

    return {
      retrievedInvoices: pastInvoices as IInvoiceDocument[],
      memoryContext,
    };
  } catch (err) {
    console.warn("⚠️ RAG node failed, continuing without memory:", err);
    return {
      memoryContext: "No past invoice history for this client.",
      retrievedInvoices: [],
    };
  }
}
