import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { routerNode } from "./nodes/routerNode";
import { ragNode } from "./nodes/ragNode";
import { generatorNode } from "./nodes/generatorNode";
import { editorNode } from "./nodes/editorNode";
import { copierNode } from "./nodes/copierNode";
import { multiInvoiceNode } from "./nodes/multiInvoiceNode";
import { IInvoiceDocument } from "../models/Invoice";
import { ParsedInvoice } from "./schemas/invoiceSchema";
import {
  InvoiceWithMatch,
  MatchResult,
  AgentIntent,
  AgentResult,
  initialState,
} from "./state";

const AgentStateAnnotation = Annotation.Root({
  prompt: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => "" }),
  userId: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => "" }),
  sessionId: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  sessionContext: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "No existing invoices in this session.",
  }),
  intent: Annotation<AgentIntent>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  isMultiple: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  isSplit: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  splitCount: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 1,
  }),
  targetRef: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  routerNotes: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  memoryContext: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "No past invoice history for this client.",
  }),
  retrievedInvoices: Annotation<IInvoiceDocument[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  parsedInvoice: Annotation<ParsedInvoice | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  parsedInvoices: Annotation<ParsedInvoice[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  invoicesWithMatch: Annotation<InvoiceWithMatch[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  matchResult: Annotation<MatchResult | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  agentResult: Annotation<AgentResult | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  responseMessage: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  error: Annotation<string | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
});

type AgentState = typeof AgentStateAnnotation.State;

function routeAfterRouter(state: AgentState): string {
  if (state.isMultiple || state.intent === "multi") return "multiInvoice";
  if (state.intent === "edit") return "editor";
  if (state.intent === "copy") return "copier";
  return "rag"; // new + default → through RAG first
}

function routeAfterMulti(state: AgentState): string {
  if (!state.isMultiple) return "generator";
  return END;
}

export function createInvoiceAgent() {
  const graph = new StateGraph(AgentStateAnnotation)
    .addNode("router", routerNode)
    .addNode("rag", ragNode)
    .addNode("generator", generatorNode)
    .addNode("editor", editorNode)
    .addNode("copier", copierNode)
    .addNode("multiInvoice", multiInvoiceNode)
    .addEdge(START, "router")
    .addConditionalEdges("router", routeAfterRouter, {
      rag: "rag",
      editor: "editor",
      copier: "copier",
      multiInvoice: "multiInvoice",
    })
    .addEdge("rag", "generator")
    .addConditionalEdges("multiInvoice", routeAfterMulti, {
      generator: "generator",
      [END]: END,
    })
    .addEdge("generator", END)
    .addEdge("editor", END)
    .addEdge("copier", END);

  return graph.compile();
}

let agentInstance: ReturnType<typeof createInvoiceAgent> | null = null;

export function getInvoiceAgent() {
  if (!agentInstance) {
    agentInstance = createInvoiceAgent();
  }
  return agentInstance;
}

export async function runInvoiceAgent(input: {
  prompt: string;
  userId: string;
  sessionId: string;
  sessionContext: string;
  memoryContext?: string;
  parsedInvoice?: ParsedInvoice | null; // Current invoice for edit context
}): Promise<AgentState> {
  const agent = getInvoiceAgent();
  const result = await agent.invoke({
    ...initialState,
    ...input,
    parsedInvoice: input.parsedInvoice || null,
    memoryContext:
      input.memoryContext || "No past invoice history for this client.",
  });
  return result as AgentState;
}
