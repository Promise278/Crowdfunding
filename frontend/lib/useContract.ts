"use client";
import { getWriteContract } from "./contract";

/**
 * Always returns the getter — wallet check happens inside getWriteContract()
 * at call time, not at render time. This avoids the SSR hydration issue where
 * isConnected is false on first render even when the wallet IS connected.
 */
export function useWriteContract() {
  return () => getWriteContract();
}
