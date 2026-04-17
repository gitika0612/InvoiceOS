import mongoose, { Document, Schema } from "mongoose";

export interface IClientDocument extends Document {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  createdAt: Date;
  updatedAt: Date;
}

const clientSchema = new Schema<IClientDocument>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    gstin: { type: String, default: "" },
  },
  { timestamps: true }
);

// Compound index — one client per email per user
clientSchema.index({ userId: 1, email: 1 }, { unique: true });

export const Client = mongoose.model<IClientDocument>("Client", clientSchema);
