export function isAffirmativeReply(reply: string) {
  const normalized = reply.toLowerCase().trim();

  return ["yes", "haan", "same", "confirm"].includes(normalized);
}

export function isSkipReply(reply: string) {
  const normalized = reply.toLowerCase().trim();

  return normalized === "skip" || normalized.includes("skip");
}
