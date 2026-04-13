import mongoose, { Document, Schema } from "mongoose";

// This defines the shape of a User in our database
export interface IUserDocument extends Document {
  clerkId: string; // Unique ID from Clerk
  email: string; // User's email
  name: string; // User's full name
  imageUrl: string; // Profile picture URL
  plan: "free" | "pro" | "business";
  isActive: boolean; // Soft delete flag
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUserDocument>(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true, // One user per Clerk ID
      index: true, // Fast lookup by clerkId
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    plan: {
      type: String,
      enum: ["free", "pro", "business"],
      default: "free",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // Auto adds createdAt and updatedAt
  }
);

export const User = mongoose.model<IUserDocument>("User", userSchema);
