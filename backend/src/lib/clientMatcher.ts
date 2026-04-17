import { Client, IClientDocument } from "../models/Client";

export type MatchType = "exact" | "partial" | "none";

export interface MatchResult {
  type: MatchType;
  client: IClientDocument | null;
  score: number;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function getMatchScore(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);

  // Exact match
  if (na === nb) return 1.0;

  const wordsA = na.split(" ");
  const wordsB = nb.split(" ");

  // One is subset of other
  // e.g. "Gitika" vs "Gitika Bhatia"
  const isSubset =
    wordsA.every((w) => nb.includes(w)) || wordsB.every((w) => na.includes(w));

  if (isSubset) return 0.75;

  // First name matches
  if (wordsA[0] === wordsB[0]) return 0.6;

  // Partial word overlap
  const overlap = wordsA.filter((w) => wordsB.includes(w)).length;
  if (overlap > 0) {
    return overlap / Math.max(wordsA.length, wordsB.length);
  }

  return 0;
}

// ── Find best matching client for a given name ──
export async function findClientMatch(
  userId: string,
  clientName: string
): Promise<MatchResult> {
  try {
    // Get all clients for this user
    const clients = await Client.find({ userId }).lean();

    if (clients.length === 0) {
      return { type: "none", client: null, score: 0 };
    }

    // Score all clients
    let bestScore = 0;
    let bestClient: IClientDocument | null = null;

    for (const client of clients) {
      const score = getMatchScore(clientName, client.name);
      if (score > bestScore) {
        bestScore = score;
        bestClient = client as unknown as IClientDocument;
      }
    }

    // Determine match type based on score
    if (bestScore >= 0.95) {
      return { type: "exact", client: bestClient, score: bestScore };
    } else if (bestScore >= 0.5) {
      return { type: "partial", client: bestClient, score: bestScore };
    } else {
      return { type: "none", client: null, score: bestScore };
    }
  } catch (err) {
    console.error("❌ Client match error:", err);
    return { type: "none", client: null, score: 0 };
  }
}
