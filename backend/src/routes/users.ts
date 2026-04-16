import { Router } from "express";
import {
  syncUser,
  getMe,
  getProfile,
  updateProfile,
} from "../controllers/userController";

const router = Router();

// Frontend calls this after every login
router.post("/sync", syncUser);

// Get current user from DB
router.get("/me", getMe);

router.get("/profile", getProfile);
router.put("/profile", updateProfile);

export default router;
