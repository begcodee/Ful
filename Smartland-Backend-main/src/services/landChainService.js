import { landContract, getLandContractStatus } from "../blockchain/landContract.js";

class BlockchainDisabledError extends Error {
  constructor(message, diagnostics = []) {
    super(message);
    this.name = "BlockchainDisabledError";
    this.diagnostics = diagnostics;
  }
}

const extractTxHash = (tx, receipt) => {
  return receipt?.hash || receipt?.transactionHash || tx?.hash || null;
};

export const ensureBlockchainEnabled = () => {
  const status = getLandContractStatus();

  if (!landContract) {
    throw new BlockchainDisabledError(
      "Blockchain contract is not configured on this server",
      status?.diagnostics || ["Unknown blockchain initialization issue"]
    );
  }

  return status;
};

export const registerLandOnChain = async ({ landId, documentHash, source = "unknown" }) => {
  ensureBlockchainEnabled();

  console.log(`[chain][${source}] registerLand start`, { landId, documentHashLength: String(documentHash || "").length });
  const tx = await landContract.registerLand(landId, documentHash);

  if (!tx?.hash) {
    throw new Error("Transaction was created but hash is missing before confirmation");
  }

  console.log(`[chain][${source}] tx sent`, { landId, txHash: tx.hash });
  const receipt = await tx.wait();
  const txHash = extractTxHash(tx, receipt);

  if (!txHash) {
    throw new Error("Transaction mined but hash is missing in both tx and receipt");
  }

  console.log(`[chain][${source}] tx confirmed`, {
    landId,
    txHash,
    blockNumber: receipt?.blockNumber || null,
    status: receipt?.status ?? null,
  });

  return { txHash, receipt };
};

export const transferLandOnChain = async ({ landId, newOwner, source = "unknown" }) => {
  ensureBlockchainEnabled();

  console.log("Calling transferLand...", { landId, newOwner, source });
  const tx = await landContract.transferLand(landId, newOwner);

  if (!tx?.hash) {
    throw new Error("Transfer transaction was created but hash is missing before confirmation");
  }

  console.log("Transaction sent: tx.hash", tx.hash);
  const receipt = await tx.wait();
  const txHash = extractTxHash(tx, receipt);

  if (!txHash) {
    throw new Error("Transfer transaction mined but hash is missing in both tx and receipt");
  }

  console.log(`[chain][${source}] transfer tx confirmed`, {
    landId,
    txHash,
    blockNumber: receipt?.blockNumber || null,
    status: receipt?.status ?? null,
  });

  return { txHash, blockNumber: receipt?.blockNumber || null, receipt };
};

export { BlockchainDisabledError };