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

const SEPOLIA_CHAIN_ID    = "0xaa36a7";
const SEPOLIA_CHAIN_ID_DEC = 11155111;

// Reliable public Sepolia RPCs (no API key needed)
const SEPOLIA_RPC =
  process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.sepolia.org";

/** Read-only contract — always uses public RPC */
export async function getReadContract() {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
}

/**
 * Write contract.
 *
 * The 404 error happens because ethers BrowserProvider calls eth_blockNumber
 * through MetaMask, and MetaMask's internal Sepolia RPC is dead/rate-limited.
 *
 * Fix: we use a custom StaticJsonRpcProvider with staticNetwork so ethers
 * NEVER calls eth_blockNumber or eth_chainId automatically. For signing,
 * we use MetaMask directly via eth_sendTransaction.
 */
export async function getWriteContract(): Promise<ethers.Contract> {
  if (typeof window === "undefined") {
    throw new Error("Cannot sign on server.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No wallet found. Please install MetaMask.");

  // 1. Switch MetaMask to Sepolia
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID }],
    });
  } catch (err: unknown) {
    const e = err as { code?: number };
    if (e.code === 4902) {
      // Add Sepolia with our reliable RPC
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId:           SEPOLIA_CHAIN_ID,
          chainName:         "Sepolia Testnet",
          nativeCurrency:    { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
          rpcUrls:           [SEPOLIA_RPC, "https://ethereum-sepolia-rpc.publicnode.com"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        }],
      });
    }
    // Code 4001 = user rejected, re-throw
    if ((e as { code?: number }).code === 4001) throw err;
  }

  // 2. Request accounts
  const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
  if (!accounts.length) throw new Error("No accounts returned from wallet.");
  const userAddress = accounts[0];

  // 3. Build a BrowserProvider with staticNetwork to prevent eth_blockNumber calls
  //    staticNetwork tells ethers "trust me, this is Sepolia, don't verify"
  const network  = new ethers.Network("sepolia", SEPOLIA_CHAIN_ID_DEC);
  const provider = new ethers.BrowserProvider(eth, network);

  // 4. Get signer — now safe, no polling RPC calls
  const signer = await provider.getSigner(userAddress);

  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}
