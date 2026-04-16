/// <reference types="node" />
import { Request, Response } from "express";
import {
  parseInvoiceWithAI,
  detectMultiInvoice,
  parseMultipleInvoices,
} from "../lib/invoiceParser";
import { Invoice } from "../models/Invoice";
import { generateInvoiceNumber } from "../lib/invoiceHelper";

// ── Parse invoice (single or multi) ──
export async function parseInvoice(req: Request, res: Response): Promise<void> {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
    res
      .status(400)
      .json({ error: "Please provide a valid invoice description" });
    return;
  }

  try {
    console.log(`🤖 Parsing: "${prompt}"`);

    // Try multi-invoice detection first
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
    } catch (detectionErr) {
      // If detection fails, fall back to single invoice
      console.warn(
        "⚠️ Multi-detection failed, falling back to single:",
        detectionErr
      );
      isMultiple = false;
    }

    if (isMultiple && subPrompts.length > 1) {
      const invoices = await parseMultipleInvoices(subPrompts);
      console.log(`✅ Parsed ${invoices.length} invoices`);
      res.status(200).json({
        success: true,
        isMultiple: true,
        invoices,
      });
    } else {
      const invoice = await parseInvoiceWithAI(prompt);
      console.log(`✅ Parsed for: ${invoice.clientName}`);
      res.status(200).json({
        success: true,
        isMultiple: false,
        invoice,
      });
    }
  } catch (err) {
    console.error("❌ Invoice parsing failed:", err);
    res
      .status(500)
      .json({ error: "Failed to parse invoice. Please try again." });
  }
}

// ── Save invoice ──
export async function saveInvoice(req: Request, res: Response): Promise<void> {
  const {
    userId,
    clientName,
    lineItems,
    paymentTermsDays,
    gstPercent,
    subtotal,
    gstAmount,
    total,
    originalPrompt,
    invoiceDate,
    invoiceMonth,
  } = req.body;

  if (!userId || !clientName || !total) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    // Duplicate check
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const duplicate = await Invoice.findOne({
      userId,
      clientName,
      total,
      createdAt: { $gte: fiveMinutesAgo },
    });

    if (duplicate) {
      console.log(`⚠️ Duplicate: ${duplicate.invoiceNumber}`);
      res
        .status(200)
        .json({ success: true, invoice: duplicate, isDuplicate: true });
      return;
    }

    const invoiceNumber = await generateInvoiceNumber();
    const terms = paymentTermsDays || 15;

    // Resolve invoice date
    const resolvedInvoiceDate = invoiceDate
      ? new Date(invoiceDate)
      : new Date();

    // Due date from invoice date
    const resolvedDueDate = new Date(
      resolvedInvoiceDate.getTime() + terms * 24 * 60 * 60 * 1000
    );

    // Auto-generate invoiceMonth if not provided
    const resolvedInvoiceMonth =
      invoiceMonth ||
      resolvedInvoiceDate.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      });

    const invoice = await Invoice.create({
      userId,
      invoiceNumber,
      clientName,
      lineItems: lineItems || [],
      paymentTermsDays: terms,
      gstPercent,
      subtotal,
      gstAmount,
      total,
      status: "draft",
      createdVia: "chat",
      originalPrompt: originalPrompt || "",
      invoiceDate: resolvedInvoiceDate,
      invoiceMonth: resolvedInvoiceMonth,
      dueDate: resolvedDueDate,
    });

    console.log(`✅ Invoice saved: ${invoiceNumber} for ${clientName}`);
    res.status(201).json({ success: true, invoice });
  } catch (err) {
    console.error("❌ Save invoice error:", err);
    res.status(500).json({ error: "Failed to save invoice" });
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

    // Sent/Overdue — only due date and status
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

    // Draft — full edit
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
        { $match: { userId: clerkId, status: { $in: ["draft", "sent"] } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Invoice.aggregate([
        {
          $match: {
            userId: clerkId,
            status: "paid",
            updatedAt: { $gte: startOfMonth },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Invoice.countDocuments({ userId: clerkId, status: "overdue" }),
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
    res.status(200).json({ success: true, invoice, client: null });
  } catch (err) {
    console.error("❌ Get invoice error:", err);
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
}
