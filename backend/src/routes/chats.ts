import { Router } from "express";
import {
  createSession,
  getUserSessions,
  deleteSession,
  getSessionMessages,
  addMessage,
  confirmInvoiceInMessage,
} from "../controllers/chatController";

const router = Router();

// ── Session routes ──
router.post("/", createSession);
router.get("/", getUserSessions);
router.delete("/:sessionId", deleteSession);

// ── Message routes ──
router.get("/:sessionId/messages", getSessionMessages);
router.post("/:sessionId/messages", addMessage);

// ── Invoice confirmation ──
router.patch(
  "/:sessionId/messages/:messageId/confirm",
  confirmInvoiceInMessage
);

export default router;
