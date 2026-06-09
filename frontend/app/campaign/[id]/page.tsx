"use client";
import { useEffect, useState, useCallback, use } from "react";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  Campaign, Milestone, STATUS_COLOR, STATUS_LABEL,
  getReadContract, getWriteContract, CONTRACT_ADDRESS, ABI,
} from "@/lib/contract";
import { fmt, fmtDate, pct, shortAddr, timeLeft } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import MilestonePanel from "@/components/MilestonePanel";
import { Btn, useToast } from "@/components/ui";

export default function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = use(params);
  const campaignId    = parseInt(idStr);

  const { address, isConnected } = useAccount();
  const { show, Toast }          = useToast();

  const [campaign,   setCampaign]   = useState<Campaign | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [myContrib,  setMyContrib]  = useState(0n);
  const [refunded,   setRefunded]   = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [ethAmt,     setEthAmt]     = useState("");
  const [funding,    setFunding]    = useState(false);
  const [busy,       setBusy]       = useState(false);

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function normCampaign(c: Record<string, unknown>): Campaign {
    return {
      creator:          String(c.creator),
      title:            String(c.title),
      description:      String(c.description),
      goal:             BigInt(c.goal as bigint),
      raised:           BigInt(c.raised as bigint),
      deadline:         BigInt(c.deadline as bigint),
      contributorCount: BigInt(c.contributorCount as bigint),
      status:           Number(c.status) as 0|1|2|3,
    };
  }

  /* ── load data ───────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    try {
      const cf = await getReadContract();
      const [c, ms] = await Promise.all([
        cf.getCampaign(campaignId),
        cf.getMilestones(campaignId),
      ]);
      setCampaign(normCampaign(c));
      setMilestones([...ms]);
      if (address) {
        const [contrib, wasRefunded] = await Promise.all([
          cf.getContribution(campaignId, address),
          cf.refunded(campaignId, address),
        ]);
        setMyContrib(BigInt(contrib));
        setRefunded(Boolean(wasRefunded));
      }
    } catch (e) {
      console.error("load error", e);
    } finally {
      setLoading(false);
    }
  }, [campaignId, address]);

  useEffect(() => { load(); }, [load]);

  /* ── contribute ──────────────────────────────────────────────────────── */
  async function contribute(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(ethAmt);
    if (!ethAmt || isNaN(amt) || amt <= 0) return show("Enter a valid ETH amount", "err");

    setFunding(true);
    try {
      const cf = await getWriteContract();      // triggers MetaMask popup
      const tx = await cf.contribute(campaignId, { value: ethers.parseEther(ethAmt) });
      show("⏳ Waiting for confirmation…");
      await tx.wait();

      // Read updated state from the same provider that just confirmed the tx
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mmProvider = new ethers.BrowserProvider((window as any).ethereum);
      const freshCf    = new ethers.Contract(CONTRACT_ADDRESS, ABI, mmProvider);

      // Retry until raised increases (node may be 1-2 blocks behind)
      let updated = await freshCf.getCampaign(campaignId);
      for (let i = 0; i < 6 && BigInt(updated.raised) <= (campaign?.raised ?? 0n); i++) {
        await new Promise(r => setTimeout(r, 2000));
        updated = await freshCf.getCampaign(campaignId);
      }

      setCampaign(normCampaign(updated));
      const signer = await mmProvider.getSigner();
      setMyContrib(BigInt(await freshCf.getContribution(campaignId, signer.address)));
      setEthAmt("");
      show(`🎉 Funded! Total raised: ${ethers.formatEther(BigInt(updated.raised))} ETH`);
    } catch (err: unknown) {
      const raw    = err instanceof Error ? err.message : String(err);
      const reason = raw.match(/reason="([^"]+)"/)?.[1]
                  ?? raw.match(/reverted with reason string '([^']+)'/)?.[1]
                  ?? raw.match(/execution reverted: ([^\n]+)/)?.[1]
                  ?? raw.slice(0, 150);
      show(reason, "err");
    } finally { setFunding(false); }
  }

  /* ── other transactions ──────────────────────────────────────────────── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function runTx(fn: (cf: any) => Promise<{ wait: () => Promise<unknown> }>) {
    setBusy(true);
    try {
      const cf = await getWriteContract();
      await (await fn(cf)).wait();
      show("Done ✓");
      load();
    } catch (err: unknown) {
      const raw    = err instanceof Error ? err.message : String(err);
      const reason = raw.match(/reason="([^"]+)"/)?.[1]
                  ?? raw.match(/reverted with reason string '([^']+)'/)?.[1]
                  ?? raw.slice(0, 150);
      show(reason, "err");
    } finally { setBusy(false); }
  }

  /* ── render guards ───────────────────────────────────────────────────── */
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

  const statusNum    = Number(campaign.status);
  const progress     = pct(campaign.raised, campaign.goal);
  const isCreator    = !!address && address.toLowerCase() === campaign.creator.toLowerCase();
  const isBacker     = myContrib > 0n;
  const deadlinePast = Date.now() / 1000 >= Number(campaign.deadline);
  const isActive     = statusNum === 0 && !deadlinePast;
  const canFinalise  = statusNum === 0 && deadlinePast;
  const canRefund    = statusNum === 2 && isBacker && !refunded;
  const completedMs  = milestones.filter(m => m.completed).length;

  return (
    <>
      <Navbar />
      {Toast}
      <main className="mx-auto max-w-2xl px-4 py-10 space-y-5">

        <Link href="/" className="text-xs text-gray-500 hover:text-indigo-400">
          ← All Campaigns
        </Link>

        {/* Title */}
        <div className="space-y-1">
          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[statusNum as 0|1|2|3]}`}>
            {STATUS_LABEL[statusNum]}
          </span>
          <h1 className="text-2xl font-bold text-white">{campaign.title}</h1>
          <p className="text-sm text-gray-400">
            by <span className="font-mono">{shortAddr(campaign.creator)}</span>
            {isCreator && <span className="ml-2 text-indigo-400">(you)</span>}
          </p>
          {campaign.description && (
            <p className="text-sm text-gray-400 pt-1 leading-relaxed">{campaign.description}</p>
          )}
        </div>

        {/* Progress */}
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-5 space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-red-400 font-medium">{progress}% funded</span>
              <span className="text-gray-500">{fmt(campaign.goal)}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-700">
              <div className="h-2 rounded-full bg-gradient-to-r from-red-500 to-pink-500 transition-all"
                style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-800 text-center">
            <div className="pr-4">
              <p className="text-lg font-bold text-white">{fmt(campaign.raised)}</p>
              <p className="text-xs text-gray-500">Raised</p>
            </div>
            <div className="px-4">
              <p className="text-lg font-bold text-white">{campaign.contributorCount.toString()}</p>
              <p className="text-xs text-gray-500">Backers</p>
            </div>
            <div className="pl-4">
              <p className="text-lg font-bold text-white">
                {deadlinePast ? "Ended" : timeLeft(campaign.deadline)}
              </p>
              <p className="text-xs text-gray-500">
                {deadlinePast ? fmtDate(campaign.deadline) : "Deadline"}
              </p>
            </div>
          </div>
        </div>

        {/* Fund section */}
        {isActive && (
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-5 space-y-3">
            <h2 className="font-semibold text-white">Back this campaign</h2>

            {isBacker && (
              <p className="text-xs text-gray-400">
                You&apos;ve contributed <span className="text-white font-medium">{fmt(myContrib)}</span> so far.
              </p>
            )}

            {!isConnected ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Connect your wallet to contribute.</p>
                <ConnectButton />
              </div>
            ) : isCreator ? (
              <p className="rounded-lg border border-yellow-800/40 bg-yellow-900/20 px-3 py-2 text-sm text-yellow-400">
                You are the creator — you cannot fund your own campaign.
              </p>
            ) : (
              <form onSubmit={contribute}>
                <div className="flex rounded-lg overflow-hidden border border-gray-600 focus-within:border-red-500 transition-colors">
                  <input
                    type="number" step="any" min="0.000001"
                    placeholder="Amount in ETH"
                    value={ethAmt}
                    onChange={e => setEthAmt(e.target.value)}
                    required
                    className="flex-1 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={funding}
                    className="shrink-0 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 text-sm font-semibold text-white transition-colors"
                  >
                    {funding
                      ? <span className="h-4 w-4 inline-block animate-spin rounded-full border-2 border-white border-t-transparent" />
                      : "Fund →"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Your wallet will ask you to sign this transaction on Sepolia.
                </p>
              </form>
            )}
          </div>
        )}

        {canFinalise && (
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-2">
            <p className="text-sm text-gray-300">Deadline passed — finalise to unlock milestones or enable refunds.</p>
            <Btn variant="outline" loading={busy} onClick={() => runTx(cf => cf.finaliseCampaign(campaignId))}>
              Finalise Campaign
            </Btn>
          </div>
        )}

        {canRefund && (
          <div className="rounded-xl bg-gray-900 border border-red-900/50 p-4 space-y-2">
            <p className="text-sm text-red-400">This campaign failed — claim your refund.</p>
            <Btn variant="danger" loading={busy} onClick={() => runTx(cf => cf.claimRefund(campaignId))}>
              Claim Refund ({fmt(myContrib)})
            </Btn>
          </div>
        )}

        {statusNum === 2 && isBacker && refunded && (
          <p className="text-center text-sm text-gray-500">Refund already claimed.</p>
        )}

        {/* Milestones */}
        <div className="space-y-3">
          <h2 className="font-semibold text-white">
            Milestones{" "}
            <span className="text-sm font-normal text-gray-500">
              ({completedMs}/{milestones.length} completed)
            </span>
          </h2>
          <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
            {milestones.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No milestones have been added yet.
              </p>
            ) : (
              <MilestonePanel
                id={campaignId}
                campaign={campaign}
                milestones={milestones}
                myAddr={address ?? ""}
                onRefresh={load}
              />
            )}
          </div>
        </div>

      </main>
    </>
  );
}
