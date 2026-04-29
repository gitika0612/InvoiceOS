/**
 * Returns true only if the prompt contains explicit edit keywords that signal
 * the user wants to modify an existing invoice — NOT create a new one.
 *
 * Used to gate whether we pass `currentInvoice` as edit context to the agent.
 * If we pass currentInvoice for a "new" prompt, the agent may misroute it as an edit.
 */
export function isEditIntent(prompt: string): boolean {
  const lower = prompt.toLowerCase();

  // Must contain an explicit modification keyword
  const hasEditKeyword =
    /\b(add|remove|delete|replace|change|update|set|increase|decrease|apply|swap|put)\b/.test(
      lower
    );

  if (!hasEditKeyword) return false;

  // Must reference an existing invoice (not just describe new work)
  const referencesExisting =
    /\b(last invoice|previous invoice|in INV-|to INV-|inv-\d+|last one|existing invoice)\b/.test(
      lower
    ) ||
    // "add X to [client]'s invoice" pattern
    /\b(to|in|from|on)\b.{0,30}\binvoice\b/.test(lower) ||
    // "add X to [client]" where client has an invoice in session — conservative check
    /\b(to|in|from)\b.{0,20}\b(rahul|priya|ankit|kartik)\b/.test(lower);

  return referencesExisting;
}
