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

// Public Sepolia RPC endpoints — no API key needed, always available
const PUBLIC_RPCS = [
  "https://rpc.sepolia.org",
  "https://rpc2.sepolia.org",
  "https://ethereum-sepolia-rpc.publicnode.com",
];

/**
 * Read-only contract.
 * - In browser: uses MetaMask if available (fastest, already on right chain)
 * - Fallback: tries public RPCs in order
 */
export async function getReadContract() {
  // Browser + MetaMask available → use it directly (no key needed, no lag)
  if (typeof window !== "undefined" && (window as any).ethereum) { // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum); // eslint-disable-line @typescript-eslint/no-explicit-any
      return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    } catch { /* fall through to public RPC */ }
  }

  // SSR or no wallet — use public RPC
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? PUBLIC_RPCS[0];
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
}

/**
 * Find the MetaMask EIP-1193 provider specifically.
 * Walks window.ethereum.providers[] when multiple wallets are installed.
 */
function getMetaMaskProvider(): ethers.Eip1193Provider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No wallet found. Please install MetaMask.");

  // Multiple wallets — find MetaMask specifically
  if (Array.isArray(eth.providers)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mm = eth.providers.find((p: any) => p.isMetaMask && !p.isPhantom);
    if (mm) return mm;
    // fallback: any MetaMask-like provider
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const any = eth.providers.find((p: any) => p.isMetaMask);
    if (any) return any;
  }

  // Single wallet
  if (eth.isMetaMask) return eth;

  // Last resort — use whatever is injected
  return eth;
}

/**
 * Write contract — uses MetaMask to sign transactions.
 */
export async function getWriteContract() {
  const mmProvider = getMetaMaskProvider();
  const provider   = new ethers.BrowserProvider(mmProvider);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}
