/// <reference types="node" />
import { Request, Response } from "express";
import {
  parseInvoiceWithAI,
  detectMultiInvoice,
  parseMultipleInvoices,
} from "../lib/invoiceParser";
import { Invoice } from "../models/Invoice";
import { generateInvoiceNumber } from "../lib/invoiceHelper";
import { findClientMatch } from "../lib/clientMatcher";

// ── Parse invoice ──
export async function parseInvoice(req: Request, res: Response): Promise<void> {
  const { prompt, userId, sessionContext } = req.body;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
    res
      .status(400)
      .json({ error: "Please provide a valid invoice description" });
    return;
  }

  try {
    console.log(`🤖 Parsing: "${prompt}"`);

    let isMultiple = false;
    let subPrompts: string[] = [];

    try {
      const detection = await detectMultiInvoice(prompt);
      console.log(
        `🔍 Multi: ${detection.isMultiple}, count: ${detection.count}`
      );
      isMultiple =
        detection.isMultiple &&
        detection.count > 1 &&
        detection.subPrompts.length > 1;
      subPrompts = detection.subPrompts;
      console.log(
        `🔍 Multi: ${detection.isMultiple}, count: ${detection.count}`
      );
      console.log("📝 Sub-prompts:", detection.subPrompts);
    } catch (detectionErr) {
      console.warn(
        "⚠️ Multi-detection failed, falling back to single:",
        detectionErr
      );
      isMultiple = false;
    }

    const context = sessionContext || "No existing invoices in this session.";

    if (isMultiple && subPrompts.length > 1) {
      const invoices = await parseMultipleInvoices(subPrompts);
      // ── Debug: check what AI returns for dates ──
      console.log(
        "📅 Invoice dates from AI:",
        invoices.map((inv) => ({
          month: inv.invoiceMonth,
          date: inv.invoiceDate,
        }))
      );
      const invoicesWithMatch = await Promise.all(
        invoices.map(async (invoice) => {
          const matchResult = userId
            ? await findClientMatch(userId, invoice.clientName)
            : { type: "none", client: null, score: 0 };
          return { invoice, matchResult };
        })
      );
      console.log(`✅ Parsed ${invoices.length} invoices`);
      res
        .status(200)
        .json({ success: true, isMultiple: true, invoicesWithMatch });
    } else {
      const invoice = await parseInvoiceWithAI(prompt, context);
      const matchResult = userId
        ? await findClientMatch(userId, invoice.clientName)
        : { type: "none", client: null, score: 0 };
      console.log(
        `✅ Parsed for: ${invoice.clientName} | Intent: ${invoice.intent} | Match: ${matchResult.type}`
      );
      res
        .status(200)
        .json({ success: true, isMultiple: false, invoice, matchResult });
    }
  } catch (err) {
    console.error("❌ Invoice parsing failed:", err);
    res
      .status(500)
      .json({ error: "Failed to parse invoice. Please try again." });
  }
}

// ── Save draft invoice ──
export async function saveDraftInvoice(
  req: Request,
  res: Response
): Promise<void> {
  const {
    userId,
    clientName,
    clientId,
    lineItems,
    paymentTermsDays,
    gstPercent,
    subtotal,
    gstAmount,
    total,
    originalPrompt,
    invoiceDate,
    invoiceMonth,
    idempotencyKey,
  } = req.body;

  if (!userId || !clientName || !total) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    // ── Idempotency check — same key = same request, return existing ──
    if (idempotencyKey) {
      const existing = await Invoice.findOne({ userId, idempotencyKey });
      if (existing) {
        console.log(
          `⚠️ Idempotent request — returning existing: ${existing.invoiceNumber}`
        );
        res
          .status(200)
          .json({ success: true, invoice: existing, isDuplicate: true });
        return;
      }
    }

    const invoiceNumber = await generateInvoiceNumber();
    const terms = paymentTermsDays || 15;
    const resolvedInvoiceDate = invoiceDate
      ? new Date(invoiceDate)
      : new Date();
    const resolvedDueDate = new Date(
      resolvedInvoiceDate.getTime() + terms * 24 * 60 * 60 * 1000
    );
    const monthYearRegex = /^[A-Za-z]+ \d{4}$/;
    const resolvedInvoiceMonth =
      invoiceMonth && monthYearRegex.test(invoiceMonth.trim())
        ? invoiceMonth.trim()
        : resolvedInvoiceDate.toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          });

    // ── Similar invoice warning — same client + same month + confirmed ──
    const similar = await Invoice.findOne({
      userId,
      clientName,
      invoiceMonth: resolvedInvoiceMonth,
      isConfirmed: true,
    });

    const invoice = await Invoice.create({
      userId,
      invoiceNumber,
      clientName,
      clientId: clientId || "",
      lineItems: lineItems || [],
      paymentTermsDays: terms,
      gstPercent,
      subtotal,
      gstAmount,
      total,
      status: "draft",
      isConfirmed: false,
      createdVia: "chat",
      originalPrompt: originalPrompt || "",
      invoiceDate: resolvedInvoiceDate,
      invoiceMonth: resolvedInvoiceMonth,
      dueDate: resolvedDueDate,
      idempotencyKey: idempotencyKey || null,
    });

    console.log(
      `✅ Draft saved: ${invoiceNumber} for ${clientName}${
        similar ? " (similar exists)" : ""
      }`
    );

    res.status(201).json({
      success: true,
      invoice,
      hasSimilar: !!similar,
      similarInvoice: similar
        ? {
            invoiceNumber: similar.invoiceNumber,
            total: similar.total,
            invoiceMonth: similar.invoiceMonth,
          }
        : null,
    });
  } catch (err) {
    console.error("❌ Save draft error:", err);
    res.status(500).json({ error: "Failed to save draft invoice" });
  }
}

// ── Confirm invoice ──
export async function confirmInvoice(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;

  try {
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const updated = await Invoice.findByIdAndUpdate(
      id,
      { isConfirmed: true },
      { new: true }
    );

    console.log(`✅ Invoice confirmed: ${updated?.invoiceNumber}`);
    res.status(200).json({ success: true, invoice: updated });
  } catch (err) {
    console.error("❌ Confirm invoice error:", err);
    res.status(500).json({ error: "Failed to confirm invoice" });
  }
}

// ── Get all invoices ──
export async function getUserInvoices(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.headers["x-clerk-id"] as string;

  if (!userId) {
    res.status(400).json({ error: "Missing user ID" });
    return;
  }

  try {
    const invoices = await Invoice.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, invoices });
  } catch (err) {
    console.error("❌ Get invoices error:", err);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
}

// ── Update invoice ──
export async function updateInvoice(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;

  try {
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    if (invoice.status === "paid") {
      res.status(403).json({ error: "Paid invoices cannot be edited" });
      return;
    }

    if (invoice.status === "sent" || invoice.status === "overdue") {
      const updated = await Invoice.findByIdAndUpdate(
        id,
        {
          ...(req.body.dueDate && { dueDate: req.body.dueDate }),
          ...(req.body.status && { status: req.body.status }),
        },
        { new: true }
      );
      res.status(200).json({ success: true, invoice: updated });
      return;
    }

    const updated = await Invoice.findByIdAndUpdate(
      id,
      {
        clientName: req.body.clientName,
        lineItems: req.body.lineItems,
        paymentTermsDays: req.body.paymentTermsDays,
        gstPercent: req.body.gstPercent,
        subtotal: req.body.subtotal,
        gstAmount: req.body.gstAmount,
        total: req.body.total,
        dueDate: req.body.dueDate,
        status: req.body.status,
        invoiceDate: req.body.invoiceDate,
        invoiceMonth: req.body.invoiceMonth,
      },
      { new: true }
    );

    console.log(`✅ Invoice updated: ${updated?.invoiceNumber}`);
    res.status(200).json({ success: true, invoice: updated });
  } catch (err) {
    console.error("❌ Update invoice error:", err);
    res.status(500).json({ error: "Failed to update invoice" });
  }
}

// ── Dashboard stats ──
export async function getDashboardStats(
  req: Request,
  res: Response
): Promise<void> {
  const clerkId = req.headers["x-clerk-id"] as string;

  if (!clerkId) {
    res.status(400).json({ error: "Missing clerk ID" });
    return;
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalInvoices,
      pendingAmount,
      paidThisMonth,
      overdueCount,
      recentInvoices,
    ] = await Promise.all([
      Invoice.countDocuments({ userId: clerkId }),
      Invoice.aggregate([
        {
          $match: {
            userId: clerkId,
            isConfirmed: true,
            status: { $in: ["draft", "sent"] },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Invoice.aggregate([
        {
          $match: {
            userId: clerkId,
            isConfirmed: true,
            status: "paid",
            updatedAt: { $gte: startOfMonth },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Invoice.countDocuments({
        userId: clerkId,
        isConfirmed: true,
        status: "overdue",
      }),
      Invoice.find({ userId: clerkId }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalInvoices,
        pendingAmount: pendingAmount[0]?.total || 0,
        paidThisMonth: paidThisMonth[0]?.total || 0,
        overdueCount,
      },
      recentInvoices,
    });
  } catch (err) {
    console.error("❌ Dashboard stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}

// ── Delete invoice ──
export async function removeInvoice(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;

  try {
    const invoice = await Invoice.findByIdAndDelete(id);
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    console.log(`✅ Invoice deleted: ${invoice.invoiceNumber}`);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Delete invoice error:", err);
    res.status(500).json({ error: "Failed to delete invoice" });
  }
}

// ── Get invoice by ID ──
export async function getInvoiceById(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;

  try {
    const invoice = await Invoice.findById(id).lean();
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    res.status(200).json({
      success: true,
      invoice: {
        ...invoice,
        invoiceNumber: invoice.invoiceNumber || null,
      },
    });
  } catch (err) {
    console.error("❌ Get invoice error:", err);
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
}
