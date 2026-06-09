"use client";
import { useWalletClient } from "wagmi";
import { getWriteContractFromWallet } from "./contract";

/**
 * Returns a ready-to-use ethers Contract bound to the
 * wallet the user connected through RainbowKit.
 * Returns null when no wallet is connected.
 */
export function useWriteContract() {
  const { data: walletClient } = useWalletClient();

  if (!walletClient) return null;
  return getWriteContractFromWallet(walletClient);
}
