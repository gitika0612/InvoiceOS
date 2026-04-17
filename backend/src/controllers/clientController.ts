import { Request, Response } from "express";
import { Client } from "../models/Client";

// ── Get all clients for a user ──
export async function getUserClients(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.headers["x-clerk-id"] as string;

  if (!userId) {
    res.status(400).json({ error: "Missing user ID" });
    return;
  }

  try {
    const clients = await Client.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, clients });
  } catch (err) {
    console.error("❌ Get clients error:", err);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
}

// ── Get single client ──
export async function getClientById(
  req: Request,
  res: Response
): Promise<void> {
  const { id } = req.params;

  try {
    const client = await Client.findById(id).lean();
    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    res.status(200).json({ success: true, client });
  } catch (err) {
    console.error("❌ Get client error:", err);
    res.status(500).json({ error: "Failed to fetch client" });
  }
}

// ── Create or update client (upsert by email) ──
export async function upsertClient(req: Request, res: Response): Promise<void> {
  const userId = req.headers["x-clerk-id"] as string;

  if (!userId) {
    res.status(400).json({ error: "Missing user ID" });
    return;
  }

  const { name, email, phone, address, city, state, pincode, gstin } = req.body;

  if (!name || !email) {
    res.status(400).json({ error: "Name and email are required" });
    return;
  }

  try {
    // Upsert — find by userId + email, update or create
    const client = await Client.findOneAndUpdate(
      { userId, email: email.toLowerCase().trim() },
      {
        name,
        email: email.toLowerCase().trim(),
        phone: phone || "",
        address: address || "",
        city: city || "",
        state: state || "",
        pincode: pincode || "",
        gstin: gstin || "",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`✅ Client upserted: ${client.name} (${client.email})`);
    res.status(200).json({ success: true, client });
  } catch (err) {
    console.error("❌ Upsert client error:", err);
    res.status(500).json({ error: "Failed to save client" });
  }
}

// ── Get client by name (for autofill) ──
export async function getClientByName(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.headers["x-clerk-id"] as string;
  const { name } = req.query;

  if (!userId) {
    res.status(400).json({ error: "Missing user ID" });
    return;
  }

  try {
    const client = await Client.findOne({
      userId,
      name: { $regex: new RegExp(`^${name}$`, "i") },
    }).lean();

    res.status(200).json({ success: true, client: client || null });
  } catch (err) {
    console.error("❌ Get client by name error:", err);
    res.status(500).json({ error: "Failed to fetch client" });
  }
}

// ── Delete client ──
export async function deleteClient(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const client = await Client.findByIdAndDelete(id);
    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    console.log(`✅ Client deleted: ${client.name}`);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Delete client error:", err);
    res.status(500).json({ error: "Failed to delete client" });
  }
}

// ── Parse client details from natural language ──
export async function parseClientDetails(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.headers["x-clerk-id"] as string;
  const { text, clientName } = req.body;

  if (!userId || !text || !clientName) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    // Simple regex-based extraction — no AI needed for structured text
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    const phoneMatch = text.match(/[6-9]\d{9}/);
    const gstinMatch = text.match(
      /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/
    );

    // Extract city — look for "City - X" or "City: X" pattern
    const cityMatch = text.match(/[Cc]ity[\s]*[-:]\s*([A-Za-z\s]+?)(?:,|$|\n)/);

    // Extract state
    const stateMatch = text.match(
      /[Ss]tate[\s]*[-:]\s*([A-Za-z\s]+?)(?:,|$|\n)/
    );

    // Extract address
    const addressMatch = text.match(/[Aa]ddress[\s]*[-:]\s*(.+?)(?:,|$|\n)/);

    const parsed = {
      email: emailMatch?.[0] || undefined,
      phone: phoneMatch?.[0] || undefined,
      gstin: gstinMatch?.[0] || undefined,
      city: cityMatch?.[1]?.trim() || undefined,
      state: stateMatch?.[1]?.trim() || undefined,
      address: addressMatch?.[1]?.trim() || undefined,
    };

    console.log("📧 Parsed client details:", parsed);

    // If we got an email, upsert the client
    if (parsed.email) {
      const client = await Client.findOneAndUpdate(
        { userId, email: parsed.email.toLowerCase().trim() },
        {
          name: clientName,
          email: parsed.email.toLowerCase().trim(),
          phone: parsed.phone || "",
          address: parsed.address || "",
          city: parsed.city || "",
          state: parsed.state || "",
          gstin: parsed.gstin || "",
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      console.log(
        `✅ Client saved from chat: ${client.name} (${client.email})`
      );
      res.status(200).json({
        success: true,
        parsed,
        client,
        saved: true,
      });
    } else {
      console.log(`⚠️ No email found in text, client not saved`);
      res.status(200).json({
        success: true,
        parsed,
        client: null,
        saved: false,
      });
    }
  } catch (err) {
    console.error("❌ Parse client details error:", err);
    res.status(500).json({ error: "Failed to parse client details" });
  }
}
