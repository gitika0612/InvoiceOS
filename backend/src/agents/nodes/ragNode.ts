import { InvoiceAgentState } from "../state";
import { findSimilarInvoices, invoiceToText } from "../../lib/embeddingService";
import { Invoice } from "../../models/Invoice";
import { IInvoiceDocument } from "../../models/Invoice";

// ── Build memory context string from past invoices ──
function buildMemoryContext(invoices: IInvoiceDocument[]): string {
  if (invoices.length === 0) return "No past invoice history for this client.";

  const lines = invoices.map((inv, i) => {
    const items = inv.lineItems
      .map((item) => `${item.description} (₹${item.rate}/${item.unit})`)
      .join(", ");
    return (
      `Invoice ${i + 1} [${inv.invoiceMonth || "unknown month"}]: ` +
      `Items: ${items} | ` +
      `GST: ${inv.gstPercent}% ${inv.gstType} | ` +
      `Terms: ${inv.paymentTermsDays} days | ` +
      `Total: ₹${inv.total.toLocaleString("en-IN")} | ` +
      `${inv.isConfirmed ? "Confirmed" : "Draft"}`
    );
  });

  // Most recent rate for each item (recency bias)
  const mostRecentRates: Record<string, number> = {};
  for (const inv of invoices) {
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
    `Past ${invoices.length} invoice(s) for this client:`,
    ...lines,
    `Most recent rates: ${rateHints}`,
    `Use these as defaults when creating new invoice for this client.`,
  ].join("\n");
}

export async function ragNode(
  state: InvoiceAgentState
): Promise<Partial<InvoiceAgentState>> {
  // Only run RAG for new/memory intents, not for edit/copy
  if (state.intent === "edit" || state.intent === "copy") {
    return { memoryContext: "No past invoice history for this client." };
  }

  try {
    const queryText = state.prompt;

    let pastInvoices = await findSimilarInvoices(
      state.userId,
      queryText,
      undefined, // no client filter — let similarity find relevant ones
      5
    );

    if (pastInvoices.length === 0) {
      // Extract rough client name from prompt for DB query
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
      ]);
      const possibleClientName = words.find(
        (w) => w.length > 2 && !commonWords.has(w.toLowerCase())
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
      pastInvoices as IInvoiceDocument[]
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
