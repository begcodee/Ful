import express from "express";
import { getTransfers, createTransfer, completeTransfer } from "../controllers/transactionsController.js";

const router = express.Router();

router.get("/", getTransfers);
router.post("/", createTransfer);
router.patch("/:id/complete", completeTransfer);

export default router;
