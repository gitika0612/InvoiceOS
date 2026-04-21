import { Router } from "express";
import {
  parseInvoice,
  saveDraftInvoice,
  confirmInvoice,
  getUserInvoices,
  updateInvoice,
  getDashboardStats,
  removeInvoice,
  getInvoiceById,
  getClientHistory,
} from "../controllers/invoiceController";

const router = Router();

router.post("/parse", parseInvoice);
router.post("/save", saveDraftInvoice);
router.patch("/:id/confirm", confirmInvoice);
router.get("/dashboard-stats", getDashboardStats);
router.get("/client-history/:clientName", getClientHistory);
router.get("/", getUserInvoices);
router.get("/:id", getInvoiceById);
router.put("/:id", updateInvoice);
router.delete("/:id", removeInvoice);

export default router;
