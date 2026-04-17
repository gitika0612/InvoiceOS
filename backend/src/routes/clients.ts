import { Router } from "express";
import {
  getUserClients,
  getClientById,
  getClientByName,
  upsertClient,
  deleteClient,
  parseClientDetails,
} from "../controllers/clientController";

const router = Router();

// ── Static routes first (before any /:id) ──
router.get("/", getUserClients);
router.get("/search", getClientByName);
router.post("/", upsertClient);
router.post("/parse-details", parseClientDetails);

// ── Dynamic routes last ──
router.get("/:id", getClientById);
router.delete("/:id", deleteClient);

export default router;
