"use client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-indigo-400 text-xl hover:text-indigo-300">
          <span className="text-2xl">⛓</span> CrowdFund
        </Link>
        <ConnectButton />
      </div>
    </nav>
  );
}
