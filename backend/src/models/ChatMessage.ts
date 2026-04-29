import mongoose, { Document, Schema } from "mongoose";

export interface IInvoiceAttachment {
  data: {
    clientName: string;
    lineItems: {
      description: string;
      quantity: number;
      unit: string;
      rate: number;
      amount: number;
      hsnSacCode?: string;
      hsnSacType?: "HSN" | "SAC";
    }[];
    paymentTermsDays: number;
    gstPercent: number;
    gstType: "IGST" | "CGST_SGST";
    cgstPercent: number;
    sgstPercent: number;
    igstPercent: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    gstAmount: number;
    discountType: "percent" | "amount" | "none";
    discountValue: number;
    discountAmount: number;
    notes: string;
    subtotal: number;
    taxableAmount: number;
    total: number;
    invoiceDate?: string;
    invoiceMonth?: string;
  };
  invoiceId?: string;
  invoiceNumber?: string;
  status: "draft" | "confirmed" | "sent" | "paid" | "overdue";
}

export interface IChatMessageDocument extends Document {
  sessionId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  invoice?: IInvoiceAttachment;
  createdAt: Date;
  updatedAt: Date;
}

const lineItemSchema = new Schema({
  description: String,
  quantity: Number,
  unit: String,
  rate: Number,
  amount: Number,
  hsnSacCode: { type: String, default: "" },
  hsnSacType: { type: String, enum: ["HSN", "SAC"], default: "SAC" },
});

const invoiceAttachmentSchema = new Schema({
  data: {
    clientName: String,
    lineItems: [lineItemSchema],
    paymentTermsDays: { type: Number, default: 15 },
    gstPercent: { type: Number, default: 18 },
    gstType: {
      type: String,
      enum: ["IGST", "CGST_SGST"],
      default: "CGST_SGST",
    },
    cgstPercent: { type: Number, default: 9 },
    sgstPercent: { type: Number, default: 9 },
    igstPercent: { type: Number, default: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    discountType: {
      type: String,
      enum: ["percent", "amount", "none"],
      default: "none",
    },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    subtotal: Number,
    taxableAmount: { type: Number, default: 0 },
    total: Number,
    invoiceDate: { type: String, default: "" },
    invoiceMonth: { type: String, default: "" },
  },
  invoiceId: { type: String, default: "" },
  invoiceNumber: { type: String, default: "" },
  status: {
    type: String,
    enum: ["draft", "confirmed", "sent", "paid", "overdue"],
    default: "draft",
  },
});

const chatMessageSchema = new Schema<IChatMessageDocument>(
  {
    sessionId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, default: "" },
    invoice: { type: invoiceAttachmentSchema, default: undefined },
  },
  { timestamps: true }
);

chatMessageSchema.index({ sessionId: 1, createdAt: 1 });

export const ChatMessage = mongoose.model<IChatMessageDocument>(
  "ChatMessage",
  chatMessageSchema
);
