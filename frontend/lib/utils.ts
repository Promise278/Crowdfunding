import { ethers } from "ethers";

export const fmt = (wei: bigint, d = 3) =>
  parseFloat(ethers.formatEther(wei)).toFixed(d) + " ETH";

export const pct = (raised: bigint, goal: bigint) =>
  goal === 0n ? 0 : Math.min(100, Number((raised * 100n) / goal));

export const timeLeft = (deadline: bigint) => {
  const s = Number(deadline) - Math.floor(Date.now() / 1000);
  if (s <= 0) return "Ended";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h left` : `${h}h ${Math.floor((s % 3600) / 60)}m left`;
};

export const shortAddr = (a: string) =>
  a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";

export const fmtDate = (ts: bigint) =>
  new Date(Number(ts) * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
