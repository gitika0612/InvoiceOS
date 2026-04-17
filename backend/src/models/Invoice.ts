import mongoose, { Document, Schema } from "mongoose";

export interface IInvoiceDocument extends Document {
  userId: string;
  invoiceNumber: string;
  clientId?: string;
  clientName: string;
  lineItems: {
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
  }[];
  paymentTermsDays: number;
  gstPercent: number;
  subtotal: number;
  gstAmount: number;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue";
  isConfirmed: boolean;
  createdVia: "chat" | "template" | "memory";
  originalPrompt?: string;
  invoiceDate: Date;
  invoiceMonth: string;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoiceDocument>(
  {
    userId: { type: String, required: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true },
    clientId: { type: String, default: "" },
    clientName: { type: String, required: true, trim: true },
    lineItems: {
      type: [
        {
          description: String,
          quantity: Number,
          unit: String,
          rate: Number,
          amount: Number,
        },
      ],
      default: [],
    },
    paymentTermsDays: { type: Number, default: 15 },
    gstPercent: { type: Number, default: 18 },
    subtotal: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ["draft", "sent", "paid", "overdue"],
      default: "draft",
    },
    isConfirmed: { type: Boolean, default: false },
    createdVia: {
      type: String,
      enum: ["chat", "template", "memory"],
      default: "chat",
    },
    originalPrompt: { type: String, default: "" },
    invoiceDate: { type: Date, default: () => new Date() },
    invoiceMonth: { type: String, default: "" },
    dueDate: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

export const Invoice = mongoose.model<IInvoiceDocument>(
  "Invoice",
  invoiceSchema
);
