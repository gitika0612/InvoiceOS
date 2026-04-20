/// <reference types="node" />
import mongoose from "mongoose";
import { syncInvoiceCounter } from "../lib/invoiceHelper";

export async function connectDB(): Promise<void> {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI as string);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    await syncInvoiceCounter();
  } catch (error) {
    console.error("❌ MongoDB connection failed:", (error as Error).message);
    process.exit(1);
  }
}
