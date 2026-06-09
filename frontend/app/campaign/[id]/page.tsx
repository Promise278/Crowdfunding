"use client";
import { useEffect, useState, useCallback, use } from "react";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Campaign, Milestone, STATUS_COLOR, STATUS_LABEL, getReadContract } from "@/lib/contract";
import { useWriteContract } from "@/lib/useContract";
import { fmt, fmtDate, pct, shortAddr, timeLeft } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import MilestonePanel from "@/components/MilestonePanel";
import { Btn, Card, Progress, useToast } from "@/components/ui";

export default function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = use(params);
  const id            = parseInt(idStr);

  const { address, isConnected } = useAccount();
  const getContract              = useWriteContract();
  const { show, Toast }          = useToast();

  const [campaign,   setCampaign]   = useState<Campaign | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [myContrib,  setMyContrib]  = useState(BigInt(0));
  const [refunded,   setRefunded]   = useState(false);
  const [loading,    setLoading]    = useState(true);

  // Fund form state
  const [ethAmt,     setEthAmt]     = useState("");
  const [funding,    setFunding]    = useState(false);

  // Other action busy flag
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const cf = await getReadContract();
      const [c, ms] = await Promise.all([cf.getCampaign(id), cf.getMilestones(id)]);
      setCampaign(c);
      setMilestones(ms);
      if (address) {
        const [contrib, wasRefunded] = await Promise.all([
          cf.getContribution(id, address),
          cf.refunded(id, address),
        ]);
        setMyContrib(contrib);
        setRefunded(wasRefunded);
      }
    } catch { /* contract not reachable yet */ }
    finally { setLoading(false); }
  }, [id, address]);

  useEffect(() => { load(); }, [load]);

  // ── Contribute ────────────────────────────────────────────────────────────
  async function contribute(e: React.FormEvent) {
    e.preventDefault();
    if (!getContract) return show("Connect your wallet first", "err");
    const amt = parseFloat(ethAmt);
    if (!ethAmt || isNaN(amt) || amt <= 0) return show("Enter a valid ETH amount", "err");

    setFunding(true);
    try {
      const cf = await getContract();
      const tx = await cf.contribute(id, { value: ethers.parseEther(ethAmt) });
      show("Transaction submitted — waiting for confirmation…");
      await tx.wait();
      show("🎉 Contribution confirmed! Raised balance updated.");
      setEthAmt("");
      load(); // refresh raised amount
    } catch (err: unknown) {
      const msg    = err instanceof Error ? err.message : "Transaction failed";
      const reason = msg.match(/reason="([^"]+)"/)?.[1]
                  ?? msg.match(/revert\s+(.+)/i)?.[1]
                  ?? msg.slice(0, 120);
      show(reason, "err");
    } finally { setFunding(false); }
  }

  // ── Generic tx runner for other actions ───────────────────────────────────
  async function runTx(fn: (cf: Awaited<ReturnType<NonNullable<typeof getContract> extends () => Promise<infer R> ? () => Promise<R> : never>>) => Promise<{ wait: () => Promise<unknown> }>) {
    if (!getContract) return show("Connect your wallet first", "err");
    setBusy(true);
    try {
      const cf = await getContract();
      const tx = await fn(cf);
      await tx.wait();
      show("Done ✓");
      load();
    } catch (err: unknown) {
      const msg    = err instanceof Error ? err.message : "Transaction failed";
      const reason = msg.match(/reason="([^"]+)"/)?.[1]
                  ?? msg.match(/revert\s+(.+)/i)?.[1]
                  ?? msg.slice(0, 120);
      show(reason, "err");
    } finally { setBusy(false); }
  }

  // ── Loading / not found ───────────────────────────────────────────────────
  if (loading) return (
    <>
      <Navbar />
      <div className="flex justify-center py-32">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    </>
  );

  if (!campaign) return (
    <>
      <Navbar />
      <div className="py-32 text-center text-gray-500">Campaign not found.</div>
    </>
  );

  const progress     = pct(campaign.raised, campaign.goal);
  const isCreator    = !!address && address.toLowerCase() === campaign.creator.toLowerCase();
  const isBacker     = myContrib > BigInt(0);
  const isActive     = campaign.status === 0;
  const canRefund    = campaign.status === 2 && isBacker && !refunded;
  const deadlinePast = Date.now() / 1000 >= Number(campaign.deadline);
  const canFinalise  = isActive && deadlinePast;

  return (
    <>
      <Navbar />
      {Toast}
      <main className="mx-auto max-w-5xl px-4 py-10 space-y-8">

        <Link href="/" className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300">
          ← All Campaigns
        </Link>

        {/* ── Two-column layout ─────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Left: campaign info (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 space-y-5">
              {/* title + status */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-white leading-tight">{campaign.title}</h1>
                  <p className="mt-1 text-sm text-gray-400">
                    by <span className="font-mono text-gray-300">{shortAddr(campaign.creator)}</span>
                    {isCreator && (
                      <span className="ml-2 text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-800">
                        You (creator)
                      </span>
                    )}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-sm font-medium ${STATUS_COLOR[campaign.status]}`}>
                  {STATUS_LABEL[campaign.status]}
                </span>
              </div>

              {/* description */}
              {campaign.description && (
                <p className="text-gray-300 text-sm leading-relaxed">{campaign.description}</p>
              )}

              {/* progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-3xl font-bold text-indigo-400">{fmt(campaign.raised)}</span>
                  <span className="text-sm text-gray-400">goal: {fmt(campaign.goal)}</span>
                </div>
                <Progress pct={progress} />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{progress}% funded</span>
                  <span>{campaign.contributorCount.toString()} backers</span>
                  <span>{deadlinePast ? `Ended ${fmtDate(campaign.deadline)}` : timeLeft(campaign.deadline)}</span>
                </div>
              </div>

              {/* your contribution badge */}
              {isBacker && (
                <div className="flex items-center gap-2 rounded-lg border border-green-800 bg-green-900/20 px-3 py-2 text-sm text-green-400">
                  ✅ You contributed <strong>{fmt(myContrib)}</strong>
                </div>
              )}
            </Card>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Goal",       value: fmt(campaign.goal) },
                { label: "Raised",     value: fmt(campaign.raised) },
                { label: "Backers",    value: campaign.contributorCount.toString() },
                { label: "Milestones", value: milestones.length.toString() },
              ].map(s => (
                <Card key={s.label} className="p-3 text-center">
                  <p className="text-lg font-bold text-white">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </Card>
              ))}
            </div>

            {/* Milestones */}
            <div>
              <h2 className="mb-3 text-lg font-semibold text-white">Milestones</h2>
              <MilestonePanel
                id={id}
                campaign={campaign}
                milestones={milestones}
                myAddr={address ?? ""}
                onRefresh={load}
              />
            </div>
          </div>

          {/* Right: fund / action panel (1/3) */}
          <div className="space-y-4">

            {/* ── FUND SECTION ────────────────────────────────────────────── */}
            {isActive && (
              <Card className="p-5 space-y-4">
                <h2 className="font-semibold text-white text-base">Back This Campaign</h2>

                {!isConnected ? (
                  /* Not connected */
                  <div className="space-y-3 text-center py-2">
                    <p className="text-sm text-gray-400">
                      Connect your wallet to contribute ETH.
                    </p>
                    <ConnectButton />
                  </div>

                ) : isCreator ? (
                  /* Creator can't fund own campaign */
                  <p className="text-sm text-yellow-500/80 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                    You created this campaign — you cannot fund it yourself.
                  </p>

                ) : (
                  /* Connected backer — show the form */
                  <form onSubmit={contribute} className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Amount (ETH)
                      </label>
                      <div className="flex rounded-lg overflow-hidden border border-gray-700 focus-within:border-indigo-500 transition-colors">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          placeholder="0.1"
                          value={ethAmt}
                          onChange={e => setEthAmt(e.target.value)}
                          required
                          className="flex-1 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none"
                        />
                        <span className="flex items-center bg-gray-700/60 px-3 text-sm text-gray-400 font-medium">
                          ETH
                        </span>
                      </div>
                    </div>

                    {/* quick amounts */}
                    <div className="flex gap-2">
                      {["0.01", "0.05", "0.1", "0.5"].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setEthAmt(v)}
                          className="flex-1 rounded-md border border-gray-700 bg-gray-800 py-1 text-xs text-gray-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors"
                        >
                          {v}
                        </button>
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={funding}
                      className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2"
                    >
                      {funding ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Confirming…
                        </>
                      ) : (
                        "💰 Contribute ETH"
                      )}
                    </button>

                    <p className="text-xs text-gray-500 text-center">
                      MetaMask will ask you to sign on Sepolia.
                    </p>
                  </form>
                )}
              </Card>
            )}

            {/* ── FINALISE / REFUND ────────────────────────────────────────── */}
            {canFinalise && (
              <Card className="p-5 space-y-3">
                <p className="text-sm text-gray-300">The deadline has passed. Finalise to unlock milestones or trigger refunds.</p>
                <Btn variant="outline" className="w-full" loading={busy}
                  onClick={() => runTx(cf => cf.finaliseCampaign(id))}>
                  Finalise Campaign
                </Btn>
              </Card>
            )}

            {canRefund && (
              <Card className="p-5 space-y-3 border-red-900/50">
                <p className="text-sm text-red-400">This campaign failed. You can claim your refund.</p>
                <Btn variant="danger" className="w-full" loading={busy}
                  onClick={() => runTx(cf => cf.claimRefund(id))}>
                  Claim Refund ({fmt(myContrib)})
                </Btn>
              </Card>
            )}

            {campaign.status === 2 && isBacker && refunded && (
              <Card className="p-4 text-center text-sm text-gray-500">
                Refund already claimed.
              </Card>
            )}

            {/* ── Campaign closed notice ───────────────────────────────────── */}
            {!isActive && campaign.status !== 2 && (
              <Card className="p-4 text-center text-sm text-gray-500">
                This campaign is {STATUS_LABEL[campaign.status].toLowerCase()} and no longer accepting funds.
              </Card>
            )}
          </div>
        </div>

      </main>
    </>
  );
}
