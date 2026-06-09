import { ethers } from "ethers";

// Safely coerce anything ethers returns into a real BigInt
const bi = (v: unknown): bigint => {
  if (v === undefined || v === null) return 0n;
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.floor(v));
  if (typeof v === "string") return BigInt(v);
  // ethers Result / object with toString
  try { return BigInt(String(v)); } catch { return 0n; }
};

export const fmt = (wei: unknown, d = 3) =>
  parseFloat(ethers.formatEther(bi(wei))).toFixed(d) + " ETH";

export const pct = (raised: unknown, goal: unknown) => {
  const r = bi(raised);
  const g = bi(goal);
  return g === 0n ? 0 : Math.min(100, Number((r * 100n) / g));
};

export const timeLeft = (deadline: unknown) => {
  const s = Number(bi(deadline)) - Math.floor(Date.now() / 1000);
  if (s <= 0) return "Ended";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h left` : `${h}h ${Math.floor((s % 3600) / 60)}m left`;
};

export const shortAddr = (a: string) =>
  a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";

export const fmtDate = (ts: unknown) =>
  new Date(Number(bi(ts)) * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
