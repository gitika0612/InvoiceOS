export const MULTI_DETECT_PROMPT = `You are an invoice assistant. Determine if this prompt requests multiple SEPARATE invoices.

MULTIPLE invoice examples:
- "Create 3 invoices for Jan, Feb, March"
- "Monthly invoice for Priya for 6 months"
- "Bill Rahul for January and February separately"

SINGLE invoice examples (multiple line items = still ONE invoice):
- "Invoice Rahul for logo design, brand guidelines and 3 revisions"
- "Bill Priya for development and bug fixes"

RECURRING RULES:
1. Specific months listed (e.g. "April, May, June, August"):
   - Use EXACTLY those months, skip unlisted ones
   - count = number of months listed

2. "X months" without listing:
   - Start from current month: {currentMonth}
   - count = X

3. Each sub-prompt must be self-contained:
   "Invoice [client] for [work] ₹[amount] with [GST]% GST for [Month YYYY], payment terms [N] days"

Original prompt: {prompt}`;
