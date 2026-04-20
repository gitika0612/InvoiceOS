import { Invoice } from "../models/Invoice";
import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter =
  mongoose.models["Counter"] || mongoose.model("Counter", counterSchema);

export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const counterId = `invoices_${year}`;

  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );

  const number = String(counter.seq).padStart(3, "0");
  return `INV-${year}-${number}`;
}

export async function syncInvoiceCounter(): Promise<void> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const counterId = `invoices_${year}`;

  try {
    // Find highest existing invoice number this year
    const latest = await Invoice.findOne({
      invoiceNumber: { $regex: `^${prefix}` },
    })
      .sort({ invoiceNumber: -1 })
      .lean();

    const currentMax = latest
      ? parseInt(latest.invoiceNumber.split("-")[2]) || 0
      : 0;

    // ── Use $max to safely set counter — never decrements ──
    await Counter.findOneAndUpdate(
      { _id: counterId },
      { $max: { seq: currentMax } }, // only updates if currentMax > existing seq
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`✅ Invoice counter synced: ${counterId} → ${currentMax}`);
  } catch (err: any) {
    // If duplicate key on counter itself — it already exists, that's fine
    if (err.code === 11000) {
      console.log(`✅ Invoice counter already exists for ${counterId}`);
      return;
    }
    console.error("❌ Failed to sync invoice counter:", err.message);
  }
}
