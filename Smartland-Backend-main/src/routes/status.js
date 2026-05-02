import express from "express";
import { landContract, getLandContractStatus } from "../blockchain/landContract.js";
import dotenv from "dotenv";

const router = express.Router();

router.get("/", async (req, res) => {
  const chainStatus = getLandContractStatus();
  res.json({
    blockchain: Boolean(landContract),
    contractAddress: chainStatus.contractAddress,
    network: chainStatus.network,
    signerAddress: chainStatus.signerAddress,
    diagnostics: chainStatus.diagnostics,
    initError: chainStatus.initError,
    status: landContract ? "connected" : "disconnected"
  });
});

export default router;
