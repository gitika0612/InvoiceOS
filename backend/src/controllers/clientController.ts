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
    // ── Step 1: Extract structured fields ──
    const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
    const phoneMatch = text.match(/[6-9]\d{9}/);
    const gstinMatch = text.match(
      /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/i
    );
    const pincodeMatch = text.match(/(?<!\d)[1-9][0-9]{5}(?!\d)/);

    // ── Step 2: Try labeled format first ──
    // e.g. "City - Greater Noida", "State: Haryana", "Address - E-24, Sector 85"
    let labeledCity = text
      .match(/[Cc]ity[\s]*[-:]\s*([A-Za-z\s]+?)(?:,|$|\n)/)?.[1]
      ?.trim();
    let labeledState = text
      .match(/[Ss]tate[\s]*[-:]\s*([A-Za-z\s]+?)(?:,|$|\n)/)?.[1]
      ?.trim();
    let labeledAddress = text
      .match(/[Aa]ddress[\s]*[-:]\s*(.+?)(?:,|$|\n)/)?.[1]
      ?.trim();

    // ── Step 3: Plain text fallback ──
    // Remove email, phone, gstin, pincode from text → remaining is address parts
    let city = labeledCity;
    let state = labeledState;
    let address = labeledAddress;

    if (!city || !state) {
      const stripped = text
        .replace(/[\w.+-]+@[\w.-]+\.\w+/, "") // remove email
        .replace(/[6-9]\d{9}/, "") // remove phone
        .replace(/[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/i, "") // remove gstin
        .replace(/\b[1-9][0-9]{5}\b/, "") // remove pincode
        .replace(/[Cc]ity[\s]*[-:]\s*/g, "") // remove labels
        .replace(/[Ss]tate[\s]*[-:]\s*/g, "")
        .replace(/[Aa]ddress[\s]*[-:]\s*/g, "")
        .replace(/,\s*,/g, ",") // clean double commas
        .replace(/^\s*,|,\s*$/g, "") // trim leading/trailing commas
        .trim();

      // Split into parts by comma
      const parts = stripped
        .split(",")
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 1); // filter single chars

      console.log("📍 Address parts:", parts);

      if (parts.length >= 3) {
        // e.g. ["E-24", "Sector85", "Greater Faridabad", "Haryana"]
        // address = first parts, city = second to last, state = last
        address = address || parts.slice(0, parts.length - 2).join(", ");
        city = city || parts[parts.length - 2];
        state = state || parts[parts.length - 1];
      } else if (parts.length === 2) {
        // e.g. ["Greater Faridabad", "Haryana"]
        city = city || parts[0];
        state = state || parts[1];
      } else if (parts.length === 1) {
        // Only one part — could be city
        city = city || parts[0];
      }
    }

    // ── Step 4: Clean state — remove pincode if it got mixed in ──
    if (state) {
      state = state.replace(/\d+/g, "").replace(/\s+/g, " ").trim();
    }

    const parsed = {
      email: emailMatch?.[0] || undefined,
      phone: phoneMatch?.[0] || undefined,
      gstin: gstinMatch?.[0]?.toUpperCase() || undefined,
      pincode: pincodeMatch?.[0] || undefined,
      city: city || undefined,
      state: state || undefined,
      address: address || undefined,
    };

    console.log("📧 Parsed client details:", parsed);

    // ── Step 5: Save if email present ──
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
          pincode: parsed.pincode || "",
          gstin: parsed.gstin || "",
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      console.log(
        `✅ Client saved: ${client.name} | city: ${client.city} | state: ${client.state} | address: ${client.address}`
      );
      res.status(200).json({
        success: true,
        parsed,
        client,
        saved: true,
      });
    } else {
      console.log(`⚠️ No email found — client not saved`);
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
