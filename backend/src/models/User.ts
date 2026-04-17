import mongoose, { Document, Schema } from "mongoose";

export interface IUserDocument extends Document {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl: string;
  plan: "free" | "pro" | "business";
  isActive: boolean;
  isOnboarded: boolean;
  // Business profile
  businessName?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  // Bank details
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUserDocument>(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    firstName: { type: String, trim: true, default: "" },
    lastName: { type: String, trim: true, default: "" },
    imageUrl: { type: String, default: "" },
    plan: {
      type: String,
      enum: ["free", "pro", "business"],
      default: "free",
    },
    isActive: { type: Boolean, default: true },
    isOnboarded: { type: Boolean, default: false },
    businessName: { type: String, default: "" },
    gstin: { type: String, default: "" },
    pan: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    phone: { type: String, default: "" },
    bankName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifscCode: { type: String, default: "" },
    upiId: { type: String, default: "" },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUserDocument>("User", userSchema);
