import { Router } from "express";
import { handleClerkWebhook } from "../controllers/webhookController";

const router = Router();

// Clerk will POST to this URL when user events happen
router.post("/clerk", handleClerkWebhook);

export default router;
