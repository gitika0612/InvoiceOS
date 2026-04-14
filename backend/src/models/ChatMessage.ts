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
    }[];
    paymentTermsDays: number;
    gstPercent: number;
    subtotal: number;
    gstAmount: number;
    total: number;
  };
  invoiceId?: string;
  invoiceNumber?: string;
  isConfirmed: boolean;
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
});

const invoiceAttachmentSchema = new Schema({
  data: {
    clientName: String,
    lineItems: [lineItemSchema],
    paymentTermsDays: { type: Number, default: 15 },
    gstPercent: { type: Number, default: 18 },
    subtotal: Number,
    gstAmount: Number,
    total: Number,
  },
  invoiceId: { type: String, default: "" },
  invoiceNumber: { type: String, default: "" },
  isConfirmed: { type: Boolean, default: false },
});

const chatMessageSchema = new Schema<IChatMessageDocument>(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    invoice: {
      type: invoiceAttachmentSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

// Fast lookup — all messages in a session
chatMessageSchema.index({ sessionId: 1, createdAt: 1 });

export const ChatMessage = mongoose.model<IChatMessageDocument>(
  "ChatMessage",
  chatMessageSchema
);
