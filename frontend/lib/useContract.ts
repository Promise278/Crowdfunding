"use client";
import { useAccount } from "wagmi";
import { getWriteContract } from "./contract";

/**
 * Returns a function that resolves to an ethers Contract
 * signed by the account currently connected in RainbowKit/MetaMask.
 */
export function useWriteContract() {
  const { address, isConnected } = useAccount();

  if (!isConnected || !address) return null;

  // Return an async getter so callers always get a fresh signer
  return () => getWriteContract(address);
}
