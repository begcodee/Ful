import express from "express";
import { castVote, getVoteResults } from "../controllers/votesController.js";

const router = express.Router();

// POST cast vote
router.post("/", castVote);

// GET vote results for dispute
router.get("/:disputeId/results", getVoteResults);

export default router;
