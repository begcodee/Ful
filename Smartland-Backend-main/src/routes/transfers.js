import express from "express";
import { cancelTransfer, completeTransfer, createTransfer, getTransfers } from "../controllers/transfersController.js";

const router = express.Router();

router.get("/", getTransfers);
router.post("/", createTransfer);
router.patch("/:id/complete", completeTransfer);
router.patch("/:id/cancel", cancelTransfer);

export default router;
