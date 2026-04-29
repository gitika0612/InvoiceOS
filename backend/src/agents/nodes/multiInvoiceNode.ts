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

// ── Month helpers ──
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Parse month names from sub-prompt text. Returns 0-indexed month number or -1.
 */
function extractMonthFromSubPrompt(subPrompt: string): number {
  const lower = subPrompt.toLowerCase();
  return MONTH_NAMES.findIndex((m) => lower.includes(m.toLowerCase()));
}

/**
 * Given a list of sub-prompts and the expected ordered months, patch each
 * sub-prompt so it references the correct month label.
 *
 * The LLM sometimes hallucinates months (e.g. April for all). We correct
 * this by:
 * 1. Parsing what months the detection schema said are needed
 * 2. Replacing the month reference in each sub-prompt with the correct one
 */
function patchSubPromptMonths(
  subPrompts: string[],
  expectedMonths: string[] // e.g. ["January 2026", "February 2026", "March 2026"]
): string[] {
  return subPrompts.map((sp, i) => {
    const expected = expectedMonths[i];
    if (!expected) return sp;

    // Replace any "Month YYYY" pattern with the expected month
    const patched = sp.replace(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
      expected
    );

    // If no replacement happened, append the month
    if (patched === sp) {
      return `${sp.trim()} for ${expected}`;
    }
    return patched;
  });
}

/**
 * Extract specific months from a prompt like "Jan, Feb, March" or "January, February, March".
 * Returns array of "Month YYYY" strings if found, or empty array.
 */
function extractExplicitMonths(prompt: string, year: number): string[] {
  const monthAbbrevMap: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };

  const found: number[] = [];
  const parts = prompt.toLowerCase().split(/[\s,]+/);
  for (const part of parts) {
    const clean = part.replace(/[^a-z]/g, "");
    if (clean in monthAbbrevMap) {
      const idx = monthAbbrevMap[clean];
      if (!found.includes(idx)) found.push(idx);
    }
  }
  return found.map((idx) => `${MONTH_NAMES[idx]} ${year}`);
}

/**
 * Generate N consecutive months starting from startMonth (0-indexed).
 */
function generateConsecutiveMonths(
  startMonthIdx: number,
  startYear: number,
  count: number
): string[] {
  const result: string[] = [];
  let m = startMonthIdx;
  let y = startYear;
  for (let i = 0; i < count; i++) {
    result.push(`${MONTH_NAMES[m]} ${y}`);
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return result;
}

export async function multiInvoiceNode(
  state: InvoiceAgentState
): Promise<Partial<InvoiceAgentState>> {
  const model = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();
  const currentMonth = now.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const currentDate = now.toISOString().split("T")[0];
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
    return { isMultiple: false };
  }

  const count = detection.subPrompts.length;

  // ── Step 2: Determine correct ordered months ──
  // Try to extract explicit months from the original prompt first
  const explicitMonths = extractExplicitMonths(state.prompt, currentYear);

  let expectedMonths: string[];
  if (explicitMonths.length === count) {
    // User said "Jan, Feb, March" — use exactly those
    expectedMonths = explicitMonths;
  } else if (explicitMonths.length > 0 && explicitMonths.length !== count) {
    // Partial match — try consecutive from first explicit month
    const firstIdx = MONTH_NAMES.indexOf(explicitMonths[0].split(" ")[0]);
    expectedMonths = generateConsecutiveMonths(
      firstIdx >= 0 ? firstIdx : currentMonthIdx,
      currentYear,
      count
    );
  } else {
    // "6 months" / "3 invoices" without specifying — start from current month
    expectedMonths = generateConsecutiveMonths(
      currentMonthIdx,
      currentYear,
      count
    );
  }

  // ── Step 3: Patch sub-prompts with correct months ──
  const patchedSubPrompts = patchSubPromptMonths(
    detection.subPrompts,
    expectedMonths
  );

  // ── Step 4: Parse each sub-prompt ──
  const invoiceStructured = model.withStructuredOutput(invoiceSchema);
  const invoiceTemplate = PromptTemplate.fromTemplate(INVOICE_PROMPT);

  const parsedInvoices: ParsedInvoice[] = [];
  for (let i = 0; i < patchedSubPrompts.length; i++) {
    const subPrompt = patchedSubPrompts[i];
    const expectedMonth = expectedMonths[i];
    const formatted = await invoiceTemplate.format({
      prompt: subPrompt,
      sessionContext: "No existing invoices in this session.",
      memoryContext: state.memoryContext,
      currentMonth: expectedMonth,
      currentDate,
      currencyRates,
    });
    const raw = (await invoiceStructured.invoke(formatted)) as ParsedInvoice;
    // Force correct invoiceMonth regardless of what the LLM returned
    const corrected = recalculateTotals({
      ...raw,
      invoiceMonth: expectedMonth,
    });
    parsedInvoices.push(corrected);
  }

  // ── Step 5: Find client matches ──
  const invoicesWithMatch = await Promise.all(
    parsedInvoices.map(async (invoice) => {
      const matchResult = state.userId
        ? await findClientMatch(state.userId, invoice.clientName)
        : { type: "none" as const, client: null, score: 0 };
      return { invoice, matchResult };
    })
  );

  // ── Step 6: Build message ──
  const clientName = parsedInvoices[0]?.clientName || "client";
  const months = expectedMonths.join(", ");
  const totalSum = parsedInvoices.reduce((sum, inv) => sum + inv.total, 0);

  const result: AgentResult = {
    action: "multi_created",
    message: `Done! Prepared **${
      parsedInvoices.length
    } invoices** for **${clientName}** (${months}).\n\nTotal value: **₹${totalSum.toLocaleString(
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
