import { ethers } from "ethers";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
  override: true,
});

import abi from "./LandRegistryABI.json" with { type: "json" };

const normalizeHex = (value) => {
  if (!value) return "";
  const trimmed = String(value).trim().replace(/^['"]|['"]$/g, "");
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
};

const rpcUrl = process.env.AMOY_RPC_URL?.trim();
const contractAddress = process.env.LAND_CONTRACT_ADDRESS?.trim();
const privateKey = normalizeHex(process.env.GOV_PRIVATE_KEY);

const privateKeyLooksLikeAddress = ethers.isAddress(privateKey);
const privateKeyLooksValidHex = /^0x[0-9a-fA-F]{64}$/.test(privateKey);

const hasValidConfig = Boolean(rpcUrl && contractAddress && privateKeyLooksValidHex);

let landContract = null;
let initError = null;
let resolvedNetwork = null;
let signerAddress = null;
const diagnostics = [];

if (!rpcUrl) {
  diagnostics.push("AMOY_RPC_URL is missing.");
}
if (!contractAddress) {
  diagnostics.push("LAND_CONTRACT_ADDRESS is missing.");
} else if (!ethers.isAddress(contractAddress)) {
  diagnostics.push("LAND_CONTRACT_ADDRESS is invalid.");
}
if (!privateKey) {
  diagnostics.push("GOV_PRIVATE_KEY is missing.");
} else if (privateKeyLooksLikeAddress) {
  diagnostics.push("GOV_PRIVATE_KEY currently contains a wallet address; it must be a 64-hex private key.");
} else if (!privateKeyLooksValidHex) {
  diagnostics.push("GOV_PRIVATE_KEY must be 64 hex chars (with or without 0x).");
}

if (hasValidConfig) {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    resolvedNetwork = await provider.getNetwork();
    const wallet = new ethers.Wallet(privateKey, provider);
    signerAddress = wallet.address;
    const deployedBytecode = await provider.getCode(contractAddress);

    if (deployedBytecode === "0x") {
      diagnostics.push("LAND_CONTRACT_ADDRESS has no deployed bytecode on the configured network.");
      console.warn("⚠️ Blockchain contract disabled: LAND_CONTRACT_ADDRESS has no deployed bytecode on this network.");
      console.warn("   - Verify AMOY_RPC_URL network and LAND_CONTRACT_ADDRESS deployment.");
    } else {
      landContract = new ethers.Contract(
        contractAddress,
        abi,
        wallet
      );
    }
  } catch (error) {
    initError = error?.message || String(error);
    diagnostics.push(`Failed to initialize signer/contract: ${initError}`);
    console.warn("⚠️ Blockchain contract disabled: failed to initialize signer/contract.");
    console.warn(`   Details: ${error.message}`);
  }
} else {
  console.warn("⚠️ Blockchain contract disabled due to invalid configuration.");
  if (!rpcUrl) {
    console.warn("   - AMOY_RPC_URL is missing.");
  }
  if (!contractAddress || !ethers.isAddress(contractAddress)) {
    console.warn("   - LAND_CONTRACT_ADDRESS is missing or invalid.");
  }
  if (!privateKey) {
    console.warn("   - GOV_PRIVATE_KEY is missing.");
  } else if (privateKeyLooksLikeAddress) {
    console.warn("   - GOV_PRIVATE_KEY currently contains a wallet address; it must be a 64-hex private key.");
  } else if (!privateKeyLooksValidHex) {
    console.warn("   - GOV_PRIVATE_KEY must be 64 hex chars (with or without 0x).\n");
  }
}

const getLandContractStatus = () => ({
  enabled: Boolean(landContract),
  contractAddress: contractAddress || null,
  rpcConfigured: Boolean(rpcUrl),
  network: resolvedNetwork
    ? {
        chainId: resolvedNetwork.chainId?.toString?.() || null,
        name: resolvedNetwork.name || null,
      }
    : null,
  signerAddress,
  initError,
  diagnostics,
});

export { landContract, getLandContractStatus };