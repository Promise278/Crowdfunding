import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CrowdFund – Decentralized Crowdfunding",
  description: "Raise funds and release them milestone by milestone on Ethereum Sepolia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full bg-gray-950 text-gray-100`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
