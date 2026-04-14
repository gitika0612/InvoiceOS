/// <reference types="node" />
import { Request, Response } from "express";
import { parseInvoiceWithAI } from "../lib/invoiceParser";
import { Invoice } from "../models/Invoice";
import { generateInvoiceNumber } from "../lib/invoiceHelper";

// Parse invoice using LangChain
export async function parseInvoice(req: Request, res: Response): Promise<void> {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
    res
      .status(400)
      .json({ error: "Please provide a valid invoice description" });
    return;
  }

  try {
    console.log(`🤖 Parsing invoice prompt: "${prompt}"`);
    const parsed = await parseInvoiceWithAI(prompt);
    console.log(`✅ Invoice parsed for: ${parsed.clientName}`);
    res.status(200).json({ success: true, invoice: parsed });
  } catch (err) {
    console.error("❌ Invoice parsing failed:", err);
    res
      .status(500)
      .json({ error: "Failed to parse invoice. Please try again." });
  }
}

// Save confirmed invoice to MongoDB
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
      console.log(`⚠️ Duplicate invoice: ${duplicate.invoiceNumber}`);
      res
        .status(200)
        .json({ success: true, invoice: duplicate, isDuplicate: true });
      return;
    }

    const invoiceNumber = await generateInvoiceNumber();
    const terms = paymentTermsDays || 15;

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
      dueDate: new Date(Date.now() + terms * 24 * 60 * 60 * 1000),
    });

    console.log(`✅ Invoice saved: ${invoiceNumber} for ${clientName}`);
    res.status(201).json({ success: true, invoice });
  } catch (err) {
    console.error("❌ Save invoice error:", err);
    res.status(500).json({ error: "Failed to save invoice" });
  }
}

// Get all invoices for a user
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
    const invoices = await Invoice.find({ userId }).sort({ createdAt: -1 }); // Newest first
    res.status(200).json({ success: true, invoices });
  } catch (err) {
    console.error("❌ Get invoices error:", err);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
}

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

    // Run all queries in parallel for speed
    const [
      totalInvoices,
      pendingAmount,
      paidThisMonth,
      overdueCount,
      recentInvoices,
    ] = await Promise.all([
      // Total invoices count
      Invoice.countDocuments({ userId: clerkId }),

      // Pending payment — sum of draft + sent invoices
      Invoice.aggregate([
        { $match: { userId: clerkId, status: { $in: ["draft", "sent"] } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),

      // Paid this month — sum
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

      // Overdue count
      Invoice.countDocuments({
        userId: clerkId,
        status: "overdue",
      }),

      // Recent 5 invoices
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

export async function getInvoiceById(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;
  console.log("🔍 Fetching invoice:", id); // ← add this

  try {
    const invoice = await Invoice.findById(id).lean();
    console.log("📄 Found:", invoice); // ← add this

    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    res.status(200).json({ success: true, invoice });
  } catch (err) {
    console.error("❌ Get invoice error:", err);
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
}
