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

const SEPOLIA_CHAIN_ID = "0xaa36a7";
const SEPOLIA_CHAIN_ID_DEC = 11155111;

// Reliable public RPC — no API key, no rate limiting
export const SEPOLIA_RPC =
  process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.sepolia.org";

/** Read-only contract using the public RPC */
export async function getReadContract() {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
}

/**
 * Wait for a tx receipt using our OWN public RPC instead of MetaMask.
 * This avoids the eth_blockNumber 404 error from MetaMask's dead RPC.
 */
export async function waitForTx(txHash: string): Promise<ethers.TransactionReceipt | null> {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  // Poll every 3 seconds, up to 5 minutes
  for (let i = 0; i < 100; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt && receipt.blockNumber) return receipt;
  }
  return null;
}

/**
 * Send a raw transaction via MetaMask (signing only, no polling).
 * Returns the tx hash immediately after MetaMask approves.
 */
export async function sendContractTx(
  method: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[],
  valueWei?: bigint
): Promise<string> {
  if (typeof window === "undefined") throw new Error("Browser only.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No wallet found. Please install MetaMask.");

  // 1. Switch to Sepolia
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID }],
    });
  } catch (err: unknown) {
    const e = err as { code?: number };
    if (e.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId:           SEPOLIA_CHAIN_ID,
          chainName:         "Sepolia Testnet",
          nativeCurrency:    { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
          rpcUrls:           [SEPOLIA_RPC],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        }],
      });
    }
    if (e.code === 4001) throw new Error("User rejected network switch.");
  }

  // 2. Get accounts
  const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
  if (!accounts.length) throw new Error("No accounts found.");
  const from = accounts[0];

  // 3. Encode the function call using the public RPC provider (no MetaMask polling)
  const provider  = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const iface     = new ethers.Interface(ABI);
  const data      = iface.encodeFunctionData(method, args);

  // 4. Estimate gas using the public RPC
  const gasEstimate = await provider.estimateGas({
    from,
    to:    CONTRACT_ADDRESS,
    data,
    value: valueWei ?? 0n,
  });

  // 5. Send via MetaMask (signing only) — returns tx hash immediately
  const txHash: string = await eth.request({
    method: "eth_sendTransaction",
    params: [{
      from,
      to:    CONTRACT_ADDRESS,
      data,
      value: valueWei ? "0x" + valueWei.toString(16) : "0x0",
      gas:   "0x" + (gasEstimate * 120n / 100n).toString(16), // +20% buffer
    }],
  });

  return txHash;
}
