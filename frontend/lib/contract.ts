import { ethers } from "ethers";
import { type WalletClient } from "viem";
import artifact from "./CrowdFund.json";

export const CONTRACT_ADDRESS = artifact.address;
export const ABI               = artifact.abi;

export type Status = 0 | 1 | 2 | 3; // Active | Successful | Failed | Completed

export interface Campaign {
  creator:          string;
  title:            string;
  description:      string;
  goal:             bigint;
  raised:           bigint;
  deadline:         bigint;
  contributorCount: bigint;
  status:           Status;
}

export interface Milestone {
  title:          string;
  amount:         bigint;
  approvals:      bigint;
  rejections:     bigint;
  votingDeadline: bigint;
  votingOpen:     boolean;
  completed:      boolean;
}

export const STATUS_LABEL = ["Active", "Successful", "Failed", "Completed"];
export const STATUS_COLOR = [
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-green-100 text-green-700 border-green-200",
  "bg-red-100 text-red-700 border-red-200",
  "bg-purple-100 text-purple-700 border-purple-200",
];

/** Read-only contract – no wallet needed */
export async function getReadContract() {
  // Use a public Sepolia RPC for reads so we don't need MetaMask to be unlocked
  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/EQaypWAkhzl0sfqSFOLQs"
  );
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
}

/**
 * Write contract – uses the wallet client from wagmi/RainbowKit
 * so it always signs with whichever account the user connected.
 */
export function getWriteContractFromWallet(walletClient: WalletClient) {
  // Convert viem WalletClient → ethers Signer
  const provider = new ethers.BrowserProvider(walletClient.transport);
  const signer   = new ethers.JsonRpcSigner(provider, walletClient.account!.address);
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}
