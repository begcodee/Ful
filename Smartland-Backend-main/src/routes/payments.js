import express from "express";
import { getPayments, createPayment, updatePaymentStatus } from "../controllers/paymentsController.js";

const router = express.Router();

router.get("/", getPayments);
router.post("/", createPayment);
router.patch("/:id", updatePaymentStatus);

export default router;
