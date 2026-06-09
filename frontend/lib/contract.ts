import { ethers } from "ethers";
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

/** Read-only — uses a JSON-RPC provider, no wallet needed */
export async function getReadContract() {
  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/EQaypWAkhzl0sfqSFOLQs"
  );
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
}

/**
 * Write contract — wraps window.ethereum with ethers BrowserProvider
 * and requests the signer for `address` (the account wagmi/RainbowKit connected).
 * MetaMask will prompt the user to sign with that exact account.
 */
export async function getWriteContract(address: string) {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask not found");
  }
  const provider = new ethers.BrowserProvider(window.ethereum);
  // getSigner(address) pins it to the connected account
  const signer   = await provider.getSigner(address);
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}
