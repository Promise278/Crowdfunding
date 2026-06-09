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

/** Read-only — dedicated JSON-RPC, no wallet needed */
export async function getReadContract() {
  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/EQaypWAkhzl0sfqSFOLQs"
  );
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
}

/**
 * Find the MetaMask EIP-1193 provider specifically.
 * When multiple wallets are installed (Phantom, Coinbase, etc.)
 * window.ethereum may point to a different wallet.
 * We walk window.ethereum.providers[] to find MetaMask explicitly.
 */
function getMetaMaskProvider(): ethers.Eip1193Provider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No wallet found. Please install MetaMask.");

  // Multiple wallets injected — find MetaMask specifically
  if (eth.providers?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mm = eth.providers.find((p: any) => p.isMetaMask && !p.isPhantom);
    if (mm) return mm;
  }

  // Single wallet — check it is MetaMask
  if (eth.isMetaMask && !eth.isPhantom) return eth;

  throw new Error(
    "MetaMask not found. Make sure MetaMask is installed and set as your active wallet."
  );
}

/**
 * Write contract — always uses MetaMask, regardless of what other
 * wallets are installed.  MetaMask will sign with its active account.
 */
export async function getWriteContract() {
  const mmProvider = getMetaMaskProvider();
  const provider   = new ethers.BrowserProvider(mmProvider);

  // Request accounts so MetaMask is definitely unlocked
  await provider.send("eth_requestAccounts", []);

  const signer = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}
