import mongoose, { Document, Schema } from "mongoose";

export interface IChatSessionDocument extends Document {
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const chatSessionSchema = new Schema<IChatSessionDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New Chat",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Fast lookup — all sessions for a user sorted by latest
chatSessionSchema.index({ userId: 1, updatedAt: -1 });

export const ChatSession = mongoose.model<IChatSessionDocument>(
  "ChatSession",
  chatSessionSchema
);
