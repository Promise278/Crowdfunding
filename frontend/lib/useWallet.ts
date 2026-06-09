"use client";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

export function useWallet() {
  const [address, setAddress]     = useState<string | null>(null);
  const [chainId, setChainId]     = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const isCorrectChain = chainId === SEPOLIA_CHAIN_ID;

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask is not installed. Please install it from metamask.io");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts: string[] = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      setAddress(accounts[0]);
      setChainId("0x" + network.chainId.toString(16));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const switchToSepolia = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (e: unknown) {
      // Chain not added – add it
      const err = e as { code?: number };
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId:         SEPOLIA_CHAIN_ID,
            chainName:       "Sepolia Test Network",
            nativeCurrency:  { name: "SepoliaETH", symbol: "SEP", decimals: 18 },
            rpcUrls:         ["https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          }],
        });
      }
    }
  }, []);

  // Auto-reconnect + listen for account/chain changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccounts = (accounts: string[]) => {
      setAddress(accounts.length ? accounts[0] : null);
    };
    const handleChain = (id: string) => setChainId(id);

    window.ethereum.request({ method: "eth_accounts" }).then((accounts: string[]) => {
      if (accounts.length) {
        setAddress(accounts[0]);
        window.ethereum.request({ method: "eth_chainId" }).then(setChainId);
      }
    });

    window.ethereum.on("accountsChanged", handleAccounts);
    window.ethereum.on("chainChanged",    handleChain);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccounts);
      window.ethereum.removeListener("chainChanged",    handleChain);
    };
  }, []);

  return { address, chainId, isCorrectChain, loading, error, connect, switchToSepolia };
}
