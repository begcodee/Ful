import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import solc from "solc";
import { ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

dotenv.config({
  path: path.resolve(rootDir, ".env"),
  override: true,
});

const rpcUrl = process.env.AMOY_RPC_URL?.trim();
const privateKeyRaw = process.env.GOV_PRIVATE_KEY?.trim();
const privateKey = privateKeyRaw?.startsWith("0x") ? privateKeyRaw : `0x${privateKeyRaw}`;

if (!rpcUrl) {
  throw new Error("AMOY_RPC_URL is missing in .env");
}

if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  throw new Error("GOV_PRIVATE_KEY must be a valid 64-hex private key");
}

const contractPath = path.resolve(rootDir, "src/blockchain/contracts/LandRegistry.sol");
const source = fs.readFileSync(contractPath, "utf8");

const input = {
  language: "Solidity",
  sources: {
    "LandRegistry.sol": {
      content: source,
    },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors?.length) {
  const fatalErrors = output.errors.filter((error) => error.severity === "error");
  if (fatalErrors.length > 0) {
    for (const error of fatalErrors) {
      console.error(error.formattedMessage);
    }
    throw new Error("Contract compilation failed");
  }
}

const contractBuild = output.contracts?.["LandRegistry.sol"]?.LandRegistry;
if (!contractBuild?.abi || !contractBuild?.evm?.bytecode?.object) {
  throw new Error("Failed to extract ABI/bytecode from compilation output");
}

const abiOutputPath = path.resolve(rootDir, "src/blockchain/LandRegistryABI.json");
fs.writeFileSync(abiOutputPath, JSON.stringify(contractBuild.abi, null, 2), "utf8");
console.log("Updated ABI file from latest contract source.");

const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(privateKey, provider);

const balanceWei = await provider.getBalance(wallet.address);
if (balanceWei === 0n) {
  throw new Error(`Signer ${wallet.address} has 0 balance on Amoy. Fund wallet first.`);
}

console.log(`Deploying from signer: ${wallet.address}`);
console.log(`Signer balance (MATIC): ${ethers.formatEther(balanceWei)}`);
console.log(`Government address configured in contract: ${wallet.address}`);

const factory = new ethers.ContractFactory(contractBuild.abi, contractBuild.evm.bytecode.object, wallet);
const contract = await factory.deploy();
await contract.waitForDeployment();
const deployedAddress = await contract.getAddress();

console.log(`Deployed LandRegistry at: ${deployedAddress}`);

const envPath = path.resolve(rootDir, ".env");
let envText = fs.readFileSync(envPath, "utf8");

if (/^LAND_CONTRACT_ADDRESS=.*/m.test(envText)) {
  envText = envText.replace(/^LAND_CONTRACT_ADDRESS=.*/m, `LAND_CONTRACT_ADDRESS=${deployedAddress}`);
} else {
  envText += `\nLAND_CONTRACT_ADDRESS=${deployedAddress}\n`;
}

fs.writeFileSync(envPath, envText, "utf8");

console.log("Updated .env LAND_CONTRACT_ADDRESS and ABI file.");
