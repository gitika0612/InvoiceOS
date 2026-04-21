import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { InvoiceAgentState, AgentIntent } from "../state";

const routerSchema = z.object({
  intent: z
    .enum(["new", "edit", "copy", "multi", "unclear"])
    .describe(
      "new = create invoice, edit = modify existing, copy = duplicate, " +
        "multi = multiple invoices requested, unclear = cannot determine"
    ),
  clientName: z
    .string()
    .describe("Client name extracted from prompt. Empty string if not found."),
  isMultiple: z
    .boolean()
    .describe(
      "True if user is asking for multiple invoices (recurring, monthly, multiple months)"
    ),
});

export async function routerNode(
  state: InvoiceAgentState
): Promise<Partial<InvoiceAgentState>> {
  const model = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const structured = model.withStructuredOutput(routerSchema);

  const result = await structured.invoke(
    `Analyze this invoice prompt and classify the intent.
    
    Session context: ${state.sessionContext}
    
    Prompt: "${state.prompt}"
    
    Rules:
    - "multi" if prompt mentions multiple months, recurring, or multiple invoices
    - "edit" if prompt wants to change an existing invoice
    - "copy" if prompt wants to duplicate an existing invoice for a new client
    - "new" if prompt wants to create a fresh single invoice
    - "unclear" if you cannot determine what the user wants`
  );

  return {
    intent: result.intent as AgentIntent,
    isMultiple: result.isMultiple,
  };
}
