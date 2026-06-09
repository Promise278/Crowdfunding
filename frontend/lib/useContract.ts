"use client";
import { useAccount } from "wagmi";
import { getWriteContract } from "./contract";

/**
 * Returns a function that resolves to an ethers Contract signed by
 * whichever account is active in MetaMask — no address pinning.
 * Returns null when no wallet is connected.
 */
export function useWriteContract() {
  const { isConnected } = useAccount();
  if (!isConnected) return null;
  return () => getWriteContract();
}
