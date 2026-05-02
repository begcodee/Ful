import express from "express";
import { createDispute, getDisputes, resolveDispute, voteOnDispute } from "../controllers/disputesController.js";

const router = express.Router();

router.get("/", getDisputes);
router.post("/", createDispute);
router.patch("/:id/vote", voteOnDispute);
router.patch("/:id/resolve", resolveDispute);

export default router;
