"use client";
import { useEffect, useState, useCallback, use } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { Campaign, Milestone, STATUS_COLOR, STATUS_LABEL, getReadContract } from "@/lib/contract";
import { useWriteContract } from "@/lib/useContract";
import { fmt, fmtDate, pct, shortAddr, timeLeft } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import FundModal from "@/components/FundModal";
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
  const [busy,       setBusy]       = useState(false);

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
    } catch { /* contract not reachable */ }
    finally { setLoading(false); }
  }, [id, address]);

  useEffect(() => { load(); }, [load]);

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
  const isCreator    = address?.toLowerCase() === campaign.creator.toLowerCase();
  const isBacker     = myContrib > BigInt(0);
  const canFund      = campaign.status === 0 && isConnected && !isCreator;
  const canRefund    = campaign.status === 2 && isBacker && !refunded;
  const deadlinePast = Date.now() / 1000 >= Number(campaign.deadline);
  const canFinalise  = campaign.status === 0 && deadlinePast;

  return (
    <>
      <Navbar />
      {Toast}
      <main className="mx-auto max-w-5xl px-4 py-10 space-y-8">

        <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300">← All Campaigns</Link>

        {/* Header */}
        <Card className="p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-white">{campaign.title}</h1>
              <p className="text-sm text-gray-400">
                by <span className="font-mono text-gray-300">{shortAddr(campaign.creator)}</span>
                {isCreator && (
                  <span className="ml-2 text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-800">You</span>
                )}
              </p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-sm font-medium ${STATUS_COLOR[campaign.status]}`}>
              {STATUS_LABEL[campaign.status]}
            </span>
          </div>

          {campaign.description && (
            <p className="text-gray-400 text-sm leading-relaxed">{campaign.description}</p>
          )}

          <div className="space-y-2">
            <Progress pct={progress} />
            <div className="flex flex-wrap justify-between text-sm gap-2">
              <div>
                <span className="text-2xl font-bold text-indigo-400">{fmt(campaign.raised)}</span>
                <span className="text-gray-500 ml-1">raised of {fmt(campaign.goal)}</span>
              </div>
              <div className="text-right text-gray-400 text-xs space-y-0.5">
                <p>👥 {campaign.contributorCount.toString()} backers</p>
                <p>📅 {deadlinePast ? `Ended ${fmtDate(campaign.deadline)}` : timeLeft(campaign.deadline)}</p>
              </div>
            </div>
          </div>

          {isBacker && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-green-800 bg-green-900/30 px-3 py-2 text-sm text-green-400">
              ✓ You contributed <strong>{fmt(myContrib)}</strong>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            {canFund && <FundModal id={id} onDone={load} />}
            {canFinalise && (
              <Btn variant="outline" loading={busy} onClick={() => runTx(cf => cf.finaliseCampaign(id))}>
                Finalise Campaign
              </Btn>
            )}
            {canRefund && (
              <Btn variant="danger" loading={busy} onClick={() => runTx(cf => cf.claimRefund(id))}>
                Claim Refund
              </Btn>
            )}
            {campaign.status === 2 && isBacker && refunded && (
              <span className="text-sm text-gray-500 self-center">Refund already claimed.</span>
            )}
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Goal",       value: fmt(campaign.goal) },
            { label: "Raised",     value: fmt(campaign.raised) },
            { label: "Backers",    value: campaign.contributorCount.toString() },
            { label: "Milestones", value: milestones.length.toString() },
          ].map(s => (
            <Card key={s.label} className="p-4 text-center">
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </Card>
          ))}
        </div>

        {/* Milestones */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-white">Milestones</h2>
          <MilestonePanel
            id={id}
            campaign={campaign}
            milestones={milestones}
            myAddr={address ?? ""}
            onRefresh={load}
          />
        </div>

      </main>
    </>
  );
}
