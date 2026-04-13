/// <reference types="node" />
import { Request, Response } from "express";
import { Webhook } from "svix";
import { User } from "../models/User";

/*
  HOW CLERK WEBHOOKS WORK:
  1. User signs up on your frontend
  2. Clerk creates the user in their system
  3. Clerk sends a POST request to your backend URL
  4. We verify it's really from Clerk using svix signature
  5. We save the user to MongoDB
*/

export async function handleClerkWebhook(
  req: Request,
  res: Response
): Promise<void> {
  // Step A — Get webhook secret from environment
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    res.status(500).json({ error: "Webhook secret not configured" });
    return;
  }

  // Step B — Get verification headers that Clerk sends
  // These headers prove the request is from Clerk, not someone else
  const svixId = req.headers["svix-id"] as string;
  const svixTimestamp = req.headers["svix-timestamp"] as string;
  const svixSignature = req.headers["svix-signature"] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).json({ error: "Missing svix headers" });
    return;
  }

  // Step C — Verify the webhook signature
  // This makes sure the request is actually from Clerk
  let event: any;
  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    event = wh.verify(JSON.stringify(req.body), {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    console.error("❌ Webhook verification failed:", (err as Error).message);
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  // Step D — Handle different event types
  const { type, data } = event;
  console.log(`📩 Webhook received: ${type}`);

  try {
    // When a NEW user signs up
    if (type === "user.created") {
      // Check if user already exists to avoid duplicates
      const existing = await User.findOne({ clerkId: data.id });
      if (!existing) {
        await User.create({
          clerkId: data.id,
          email: data.email_addresses[0]?.email_address || "",
          name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
          imageUrl: data.image_url || "",
        });
        console.log(
          `✅ New user saved: ${data.email_addresses[0]?.email_address}`
        );
      }
    }

    // When user UPDATES their profile
    if (type === "user.updated") {
      await User.findOneAndUpdate(
        { clerkId: data.id },
        {
          email: data.email_addresses[0]?.email_address || "",
          name: `${data.first_name || ""} ${data.last_name || ""}`.trim(),
          imageUrl: data.image_url || "",
        },
        { new: true }
      );
      console.log(`✅ User updated: ${data.id}`);
    }

    // When user DELETES their account
    // We don't actually delete, just mark as inactive
    if (type === "user.deleted") {
      await User.findOneAndUpdate({ clerkId: data.id }, { isActive: false });
      console.log(`✅ User deactivated: ${data.id}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ Webhook handler error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
