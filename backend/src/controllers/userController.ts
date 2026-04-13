/// <reference types="node" />
import { Request, Response } from "express";
import { User } from "../models/User";

/*
  WHY DO WE NEED syncUser?
  
  Webhooks can sometimes fail or be delayed.
  So we also call syncUser from the frontend
  after every login to make sure the user
  always exists in our database.
*/

export async function syncUser(req: Request, res: Response): Promise<void> {
  const { clerkId, email, name } = req.body;

  if (!clerkId || !email) {
    res.status(400).json({ error: "clerkId and email are required" });
    return;
  }

  try {
    // upsert means:
    // - If user exists → update their info
    // - If user doesn't exist → create them
    const user = await User.findOneAndUpdate(
      { clerkId },
      { email, name: name || "" },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ success: true, user });
  } catch (err) {
    console.error("❌ Sync user error:", err);
    res.status(500).json({ error: "Failed to sync user" });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const clerkId = req.headers["x-clerk-id"] as string;

  if (!clerkId) {
    res.status(400).json({ error: "Missing clerk ID" });
    return;
  }

  try {
    const user = await User.findOne({ clerkId, isActive: true });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(200).json({ user });
  } catch (err) {
    console.error("❌ Get user error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
