import { ParsedInvoice } from "./schemas/invoiceSchema";
import { IClientDocument } from "../models/Client";
import { IInvoiceDocument } from "../models/Invoice";

export type AgentIntent =
  | "new"
  | "edit"
  | "copy"
  | "multi"
  | "memory"
  | "unclear"
  | null;

export interface MatchResult {
  type: "exact" | "partial" | "none";
  client: IClientDocument | null;
  score: number;
}

export interface InvoiceWithMatch {
  invoice: ParsedInvoice;
  matchResult: MatchResult;
}

export interface InvoiceAgentState {
  prompt: string;
  userId: string;
  sessionId: string;
  sessionContext: string;
  intent: AgentIntent;
  isMultiple: boolean;
  memoryContext: string;
  retrievedInvoices: IInvoiceDocument[];
  parsedInvoice: ParsedInvoice | null;
  parsedInvoices: ParsedInvoice[];
  invoicesWithMatch: InvoiceWithMatch[];
  matchResult: MatchResult | null;
  responseMessage: string;
  error: string | null;
}

// ── Used as input to runInvoiceAgent ──
export const initialState: Omit<
  InvoiceAgentState,
  "prompt" | "userId" | "sessionId" | "sessionContext"
> = {
  intent: null,
  isMultiple: false,
  memoryContext: "No past invoice history for this client.",
  retrievedInvoices: [],
  parsedInvoice: null,
  parsedInvoices: [],
  invoicesWithMatch: [],
  matchResult: null,
  responseMessage: "",
  error: null,
};
