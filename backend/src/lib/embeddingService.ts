import { OpenAIEmbeddings } from "@langchain/openai";
import { Invoice, IInvoiceDocument } from "../models/Invoice";

// ── Single embedding model instance (reused across calls) ──
const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small", // 1536 dimensions, cheapest, very good
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// ── Convert invoice to text for embedding ──
export function invoiceToText(invoice: Partial<IInvoiceDocument>): string {
  const items = invoice.lineItems
    ?.map(
      (i) =>
        `${i.description} quantity ${i.quantity} rate ₹${i.rate} amount ₹${i.amount}`
    )
    .join("; ");

  return `
    Client: ${invoice.clientName}
    Work done: ${items || "no items"}
    GST: ${invoice.gstPercent}%
    Payment terms: ${invoice.paymentTermsDays} days
    Subtotal: ₹${invoice.subtotal}
    Total: ₹${invoice.total}
    Month: ${invoice.invoiceMonth || ""}
  `
    .trim()
    .replace(/\s+/g, " ");
}

// ── Generate embedding for a single invoice ──
export async function generateEmbedding(text: string): Promise<number[]> {
  const [vector] = await embeddings.embedDocuments([text]);
  return vector;
}

// ── Generate and store embedding for a single invoice ──
export async function embedInvoice(invoiceId: string): Promise<void> {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return;

  const text = invoiceToText(invoice);
  const vector = await generateEmbedding(text);

  await Invoice.findByIdAndUpdate(invoiceId, {
    embedding: vector,
    embeddedAt: new Date(),
  });

  console.log(`✅ Embedded invoice: ${invoice.invoiceNumber}`);
}

// ── Cosine similarity between two vectors ──
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Vector search: find top-k similar invoices for a client ──
export async function findSimilarInvoices(
  userId: string,
  queryText: string,
  clientName?: string,
  topK: number = 5
): Promise<(IInvoiceDocument & { similarityScore: number })[]> {
  // 1. Embed the query
  const queryVector = await generateEmbedding(queryText);

  // 2. Fetch candidate invoices from MongoDB
  //    Only invoices that have been embedded
  //    Filter by client if provided
  const filter: Record<string, any> = {
    userId,
    embeddedAt: { $exists: true },
  };
  if (clientName) {
    // Case-insensitive client match
    filter.clientName = { $regex: new RegExp(`^${clientName}$`, "i") };
  }

  // Fetch with embedding field (normally excluded via select: false)
  const candidates = await Invoice.find(filter)
    .select("+embedding")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  if (candidates.length === 0) return [];

  // 3. Compute cosine similarity for each candidate
  const scored = candidates
    .filter((inv) => inv.embedding && inv.embedding.length > 0)
    .map((inv) => ({
      ...inv,
      similarityScore: cosineSimilarity(queryVector, inv.embedding!),
    }));

  // 4. Sort by similarity descending, return top-k
  scored.sort((a, b) => b.similarityScore - a.similarityScore);
  return scored.slice(0, topK) as any;
}

// ── Backfill: embed all confirmed invoices that don't have embeddings yet ──
export async function backfillEmbeddings(userId?: string): Promise<void> {
  const filter: Record<string, any> = {
    isConfirmed: true,
    embeddedAt: { $exists: false },
  };
  if (userId) filter.userId = userId;

  const invoices = await Invoice.find(filter).limit(100);

  if (invoices.length === 0) {
    console.log("✅ All invoices already embedded");
    return;
  }

  console.log(`🔄 Backfilling embeddings for ${invoices.length} invoices...`);

  // Process in batches of 10 to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < invoices.length; i += batchSize) {
    const batch = invoices.slice(i, i + batchSize);
    await Promise.all(batch.map((inv) => embedInvoice(inv._id.toString())));
    console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} done`);

    // Small delay between batches to avoid OpenAI rate limits
    if (i + batchSize < invoices.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log("✅ Backfill complete");
}
