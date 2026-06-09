import { ethers } from "ethers";
import artifact from "./CrowdFund.json";

export const CONTRACT_ADDRESS = artifact.address;
export const ABI               = artifact.abi;

export type Status = 0 | 1 | 2 | 3;

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

/** Read-only contract — uses public Sepolia RPC, works everywhere including SSR */
export async function getReadContract() {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.sepolia.org";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
}

/**
 * Write contract — calls window.ethereum directly.
 * Works with MetaMask, Coinbase Wallet, Brave Wallet, any injected EIP-1193 provider.
 * The connected RainbowKit wallet is always window.ethereum after the user approves.
 */
export async function getWriteContract(): Promise<ethers.Contract> {
  if (typeof window === "undefined") {
    throw new Error("Cannot sign transactions on the server.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;

  if (!win.ethereum) {
    throw new Error("No wallet detected. Please install MetaMask.");
  }

  // Request account access — this triggers the MetaMask popup if not already connected
  await win.ethereum.request({ method: "eth_requestAccounts" });

  const provider = new ethers.BrowserProvider(win.ethereum);
  const signer   = await provider.getSigner();

  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}
