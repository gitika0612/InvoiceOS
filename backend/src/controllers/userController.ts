/// <reference types="node" />
import { Request, Response } from "express";
import { User } from "../models/User";

export async function syncUser(req: Request, res: Response): Promise<void> {
  const { clerkId, email, firstName, lastName, imageUrl } = req.body;

  if (!clerkId || !email) {
    res.status(400).json({ error: "clerkId and email are required" });
    return;
  }

  try {
    const user = await User.findOneAndUpdate(
      { clerkId },
      {
        email,
        firstName: firstName || "",
        lastName: lastName || "",
        imageUrl: imageUrl || "",
      },
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

export async function getProfile(req: Request, res: Response): Promise<void> {
  const clerkId = req.headers["x-clerk-id"] as string;

  if (!clerkId) {
    res.status(400).json({ error: "Missing clerk ID" });
    return;
  }

  try {
    const user = await User.findOne({ clerkId }).lean();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(200).json({ success: true, profile: user });
  } catch (err) {
    console.error("❌ Get profile error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
}

export async function updateProfile(
  req: Request,
  res: Response
): Promise<void> {
  const clerkId = req.headers["x-clerk-id"] as string;

  if (!clerkId) {
    res.status(400).json({ error: "Missing clerk ID" });
    return;
  }

  const {
    businessName,
    gstin,
    pan,
    address,
    city,
    state,
    pincode,
    phone,
    bankName,
    accountNumber,
    ifscCode,
    upiId,
  } = req.body;

  try {
    const user = await User.findOneAndUpdate(
      { clerkId },
      {
        businessName: businessName || "",
        gstin: gstin || "",
        pan: pan || "",
        address: address || "",
        city: city || "",
        state: state || "",
        pincode: pincode || "",
        phone: phone || "",
        bankName: bankName || "",
        accountNumber: accountNumber || "",
        ifscCode: ifscCode || "",
        upiId: upiId || "",
      },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    console.log(`✅ Profile updated for ${clerkId}`);
    res.status(200).json({ success: true, profile: user });
  } catch (err) {
    console.error("❌ Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
}
