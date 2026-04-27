import { ParsedInvoice } from "./schemas/invoiceSchema";
import { IClientDocument } from "../models/Client";
import { IInvoiceDocument } from "../models/Invoice";

export type AgentIntent =
  | "new"
  | "edit"
  | "copy"
  | "multi"
  | "memory"
  | "split"
  | "unclear"
  | null;

export type AgentAction =
  | "created" // New invoice(s) ready — frontend saves draft
  | "edited" // Invoice edited — frontend updates in-session invoice
  | "copied" // Invoice copied — frontend saves new draft
  | "multi_created" // Multiple invoices ready
  | "needs_client" // New client, need email/details from user
  | "ambiguous" // Multiple matching invoices — ask user which one
  | "not_found" // Referenced invoice not found in session
  | "unclear" // Could not understand the prompt
  | "info"; // Just informational (no invoice action)

export interface MatchResult {
  type: "exact" | "partial" | "none";
  client: IClientDocument | null;
  score: number;
}

export interface InvoiceWithMatch {
  invoice: ParsedInvoice;
  matchResult: MatchResult;
}

// The structured response the agent returns to the API layer
export interface AgentResult {
  action: AgentAction;
  message: string; // Human-readable chat message
  invoice?: ParsedInvoice | null; // Single invoice
  invoices?: ParsedInvoice[]; // Multiple invoices
  targetRef?: string; // For edit: which invoice was edited
  changedFields?: string[]; // For edit: what changed
  warning?: string; // Non-fatal warning
  matchResult?: MatchResult | null; // Client match result
  invoicesWithMatch?: InvoiceWithMatch[];
  // Split details
  splitDetails?: {
    originalAmount: number;
    parts: number;
    amountPerPart: number;
  };
}

export interface InvoiceAgentState {
  prompt: string;
  userId: string;
  sessionId: string;
  sessionContext: string;
  intent: AgentIntent;
  isMultiple: boolean;
  isSplit: boolean;
  splitCount: number;
  targetRef: string;
  routerNotes: string;
  memoryContext: string;
  retrievedInvoices: IInvoiceDocument[];
  parsedInvoice: ParsedInvoice | null;
  parsedInvoices: ParsedInvoice[];
  invoicesWithMatch: InvoiceWithMatch[];
  matchResult: MatchResult | null;
  agentResult: AgentResult | null; // Final result returned to frontend
  responseMessage: string;
  error: string | null;
}

export const initialState: Omit<
  InvoiceAgentState,
  "prompt" | "userId" | "sessionId" | "sessionContext"
> = {
  intent: null,
  isMultiple: false,
  isSplit: false,
  splitCount: 1,
  targetRef: "",
  routerNotes: "",
  memoryContext: "No past invoice history for this client.",
  retrievedInvoices: [],
  parsedInvoice: null,
  parsedInvoices: [],
  invoicesWithMatch: [],
  matchResult: null,
  agentResult: null,
  responseMessage: "",
  error: null,
};
