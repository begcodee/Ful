import express from "express";
import { landContract, getLandContractStatus } from "../blockchain/landContract.js";
import { BlockchainDisabledError, ensureBlockchainEnabled, registerLandOnChain, transferLandOnChain } from "../services/landChainService.js";

const router = express.Router();

const ensureContract = (res) => {
  if (!landContract) {
    const status = getLandContractStatus();
    res.status(503).json({
      error: "Blockchain contract is not configured on this server",
      diagnostics: status.diagnostics,
      initError: status.initError,
    });
    return false;
  }

  return true;
};

router.post("/register", async (req, res) => {
  console.log("[controller][chain.register] entering controller", { bodyKeys: Object.keys(req.body || {}) });
  try {
    ensureBlockchainEnabled();
    if (!ensureContract(res)) return;
    const { landId, documentHash } = req.body;
    console.log("[controller][chain.register] before blockchain call", { landId });

    const { txHash, receipt } = await registerLandOnChain({
      landId,
      documentHash,
      source: "route.register",
    });

    console.log("[controller][chain.register] after transaction is sent", { landId, txHash });

    res.json({
      message: "Land registered on chain",
      txHash,
      blockNumber: receipt?.blockNumber || null,
      receiptStatus: receipt?.status ?? null,
    });
  } catch (e) {
    if (e instanceof BlockchainDisabledError) {
      return res.status(503).json({
        error: e.message,
        diagnostics: e.diagnostics,
      });
    }
    res.status(400).json({ error: e.message });
  }
});

router.get("/:landId", async (req, res) => {
  try {
    if (!ensureContract(res)) return;
    const landId = req.params.landId;
    const data = await landContract.getLand(landId);

    res.json({
      landId: data[0].toString(),
      owner: data[1],
      documentHash: data[2]
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/transfer", async (req, res) => {
  try {
    ensureBlockchainEnabled();
    if (!ensureContract(res)) return;
    const { landId, newOwner } = req.body;

    const { txHash, blockNumber } = await transferLandOnChain({
      landId,
      newOwner,
      source: "route.transfer",
    });

    res.json({ txHash, blockNumber });
  } catch (e) {
    if (e instanceof BlockchainDisabledError) {
      return res.status(503).json({
        error: e.message,
        diagnostics: e.diagnostics,
      });
    }
    res.status(400).json({ error: e.message });
  }
});

export default router;