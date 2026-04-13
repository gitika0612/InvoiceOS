import { Router } from "express";
import { syncUser, getMe } from "../controllers/userController";

const router = Router();

// Frontend calls this after every login
router.post("/sync", syncUser);

// Get current user from DB
router.get("/me", getMe);

export default router;
