import { Router } from "express";
import {
  parseInvoice,
  saveInvoice,
  getUserInvoices,
  updateInvoice,
  getDashboardStats,
  removeInvoice,
  getInvoiceById,
} from "../controllers/invoiceController";

const router = Router();

router.post("/parse", parseInvoice);
router.post("/save", saveInvoice);
router.get("/dashboard-stats", getDashboardStats);
router.get("/:id", getInvoiceById);
router.get("/", getUserInvoices);
router.put("/:id", updateInvoice);
router.delete("/:id", removeInvoice);

export default router;
