export const MULTI_DETECT_PROMPT = `You are detecting if a prompt requests MULTIPLE SEPARATE invoices.

Current date: {currentDate}
Current month: {currentMonth}

MULTI-INVOICE TRIGGERS:
- Specific months listed: "for Jan, Feb, March" → 3 sub-prompts
- "N months" / "for 6 months" / "monthly for N months" → N sub-prompts from current month
- "3 invoices" → 3 identical sub-prompts
- Multiple clients in one prompt: "Invoice Rahul ₹X and Priya ₹Y" → 2 sub-prompts

SINGLE INVOICE (multiple line items ≠ multiple invoices):
- "Invoice Rahul for logo design, brand guidelines and revisions" → 1 invoice with 3 line items
- "Bill Priya for development and bug fixes" → 1 invoice with 2 line items

RECURRING RULES:
1. Specific months listed (e.g. "April, May, June, August"):
   - Use EXACTLY those months, skip unlisted months
   - count = number of months listed

2. "X months" without specifying which:
   - Start from {currentMonth}
   - count = X consecutive months

3. Each sub-prompt MUST be self-contained with:
   - Client name
   - Line item description and amount
   - GST rate
   - Payment terms
   - Specific month (e.g. "April 2026", "May 2026")

EXAMPLE 1:
Prompt: "Create 3 invoices for Rahul for Jan, Feb, March each ₹45,000 with 18% GST"
→ isMultiple: true, count: 3
→ subPrompts: [
    "Invoice Rahul for services ₹45,000 with 18% GST for January 2026, payment terms 15 days",
    "Invoice Rahul for services ₹45,000 with 18% GST for February 2026, payment terms 15 days",
    "Invoice Rahul for services ₹45,000 with 18% GST for March 2026, payment terms 15 days"
  ]

EXAMPLE 2:
Prompt: "Monthly invoice for Priya for web maintenance ₹15,000/month for 6 months"
→ isMultiple: true, count: 6
→ subPrompts: [
    "Invoice Priya for web maintenance ₹15,000 for April 2026, payment terms 15 days",
    "Invoice Priya for web maintenance ₹15,000 for May 2026, payment terms 15 days",
    "Invoice Priya for web maintenance ₹15,000 for June 2026, payment terms 15 days",
    "Invoice Priya for web maintenance ₹15,000 for July 2026, payment terms 15 days",
    "Invoice Priya for web maintenance ₹15,000 for August 2026, payment terms 15 days",
    "Invoice Priya for web maintenance ₹15,000 for September 2026, payment terms 15 days"
  ]

EXAMPLE 3 (single invoice — do NOT split):
Prompt: "Invoice Rahul for logo design ₹20,000, brand guidelines ₹15,000, 3 revisions ₹5,000"
→ isMultiple: false, count: 1, subPrompts: []

Original prompt: {prompt}`;
