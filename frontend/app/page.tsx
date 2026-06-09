"use client";
import { useEffect, useState, useCallback } from "react";
import { Campaign, getReadContract } from "@/lib/contract";
import Navbar from "@/components/Navbar";
import CampaignCard from "@/components/CampaignCard";
import CreateCampaign from "@/components/CreateCampaign";

export default function Home() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("All");

  const load = useCallback(async () => {
    try {
      const cf   = await getReadContract();
      const data = await cf.getAllCampaigns();
      setCampaigns([...data].reverse());
    } catch { /* contract not deployed yet */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const STATUS = ["All", "Active", "Successful", "Failed", "Completed"];
  const filtered = campaigns.filter(c =>
    filter === "All" || ["Active","Successful","Failed","Completed"][c.status] === filter
  );

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10">

        {/* Hero */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-white mb-3">
            Decentralized <span className="text-indigo-400">Crowdfunding</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-sm">
            Back projects you believe in. Funds are locked in escrow and released only when milestones are approved by backers.
          </p>
        </div>

        {/* toolbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          {/* filters */}
          <div className="flex gap-2 flex-wrap">
            {STATUS.map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filter === s
                    ? "bg-indigo-600 text-white"
                    : "border border-gray-700 text-gray-400 hover:border-indigo-500 hover:text-indigo-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <CreateCampaign onCreated={load} />
        </div>

        {/* grid */}
        {loading ? (
          <div className="flex justify-center py-24">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center text-gray-500">
            {campaigns.length === 0
              ? "No campaigns yet. Be the first to create one!"
              : "No campaigns match this filter."}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c, i) => (
              <CampaignCard key={i} c={c} id={campaigns.length - 1 - i} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
