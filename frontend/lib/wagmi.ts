import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName:   "CrowdFund",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "3b14411b93e165dae0394e21dc6d13b2",
  chains:    [sepolia],
  ssr:       true,
});
