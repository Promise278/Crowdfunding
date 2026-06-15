"use client";
import { useState } from "react";
import { ethers } from "ethers";
import { Campaign, Milestone, sendContractTx, waitForTx } from "@/lib/contract";
import { fmt, timeLeft } from "@/lib/utils";
import { useToast } from "./ui";

interface Props {
  id:         number;
  campaign:   Campaign;
  milestones: Milestone[];
  myAddr:     string;
  isBacker:   boolean;
  onRefresh:  () => void;
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent inline-block align-middle" />;
}

export default function MilestonePanel({ id, campaign, milestones, myAddr, isBacker, onRefresh }: Props) {
  const { show, Toast } = useToast();
  const [busy,    setBusy]    = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form,    setForm]    = useState({ title: "", amount: "" });
  const [debug,   setDebug]   = useState("");

  const isCreator = !!myAddr && myAddr.toLowerCase() === campaign.creator.toLowerCase();
  const status    = Number(campaign.status);

  async function send(label: string, method: string, args: unknown[], value?: bigint) {
    setBusy(label);
    setDebug("Waiting for MetaMask approval…");
    try {
      const hash = await sendContractTx(method, args, value);
      setDebug("Transaction sent — confirming on Sepolia…");
      const receipt = await waitForTx(hash);
      if (!receipt) throw new Error("Timed out. Check Sepolia Etherscan.");
      setDebug("");
      show("✅ Done!");
      onRefresh();
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      const msg = raw.match(/reason="([^"]+)"/)?.[1]
               ?? raw.match(/reverted with reason string '([^']+)'/)?.[1]
               ?? raw.slice(0, 150);
      setDebug("❌ Error: " + raw.slice(0, 200));
      show(msg, "err");
    } finally { setBusy(null); }
  }

  async function onAddMilestone(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!form.title || !form.amount) return;
    await send("add", "addMilestone", [id, form.title, ethers.parseEther(form.amount)]);
    setForm({ title: "", amount: "" });
    setAddOpen(false);
  }

  // ── The correct flow ─────────────────────────────────────────────────────
  //
  //  STEP 1  Creator adds milestone          → addMilestone()
  //  STEP 2  Creator opens vote              → requestMilestonePayout()
  //  STEP 3  Backers vote approve / reject   → vote()
  //  STEP 4  Anyone finalises after 3 days   → finaliseVoting()
  //             if >50% approve → ETH sent to creator automatically
  //
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 space-y-5">
      {Toast}

      {/* tx debug strip */}
      {debug && (
        <div className="rounded-lg border border-yellow-600/30 bg-gray-800 px-3 py-2 text-xs text-yellow-400 font-mono break-all">
          {debug}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          CREATOR — add milestone (Active or Successful)
         ═══════════════════════════════════════════════════════════════ */}
      {isCreator && status <= 1 && (
        <div>
          {!addOpen ? (
            <button
              onClick={() => setAddOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-700 hover:border-indigo-500 py-5 text-sm text-gray-400 hover:text-indigo-300 transition-colors"
            >
              <span className="text-xl leading-none">+</span>
              Add Milestone
            </button>
          ) : (
            <div className="rounded-xl border border-indigo-600/40 bg-indigo-950/20 p-4 space-y-3">
              <p className="text-sm font-semibold text-white">New Milestone</p>
              <form onSubmit={onAddMilestone} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Title</label>
                  <input
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                    placeholder="e.g. UI Design, Smart Contract Audit"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Payout (ETH)</label>
                  <input
                    type="number" step="any" min="0.001"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                    placeholder="0.5"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={busy === "add"}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-2 text-sm font-semibold text-white transition-colors">
                    {busy === "add" && <Spinner />} Save Milestone
                  </button>
                  <button type="button" onClick={() => setAddOpen(false)}
                    className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Hint when campaign still active */}
          {status === 0 && milestones.length > 0 && (
            <p className="mt-3 text-xs text-gray-500 text-center">
              ℹ️ You can open voting on milestones once the campaign is finalised as <span className="text-green-400">Successful</span>.
            </p>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MILESTONE LIST
         ═══════════════════════════════════════════════════════════════ */}
      {milestones.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-2xl mb-2">🏁</p>
          <p className="text-sm text-gray-400 font-medium">No milestones yet</p>
          <p className="text-xs text-gray-600 mt-1">
            {isCreator ? "Add a milestone above to get started." : "The creator hasn't added any milestones yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {milestones.map((m, idx) => {
            const total       = Number(campaign.contributorCount);
            const appPct      = total ? Math.round((Number(m.approvals) / total) * 100) : 0;
            const rejPct      = total ? Math.round((Number(m.rejections) / total) * 100) : 0;
            const votingEnded = m.votingOpen && Date.now() / 1000 > Number(m.votingDeadline);

            // STEP 2: creator opens voting (requestMilestonePayout = opens vote)
            const canOpenVote = isCreator && status === 1 && !m.votingOpen && !m.completed;

            // STEP 3: backer votes
            const canVote = isBacker && !isCreator && m.votingOpen && !votingEnded;

            // STEP 4: anyone finalises — if approved, ETH auto-sent to creator
            const canFinalise = m.votingOpen && votingEnded;

            return (
              <div key={idx} className={`rounded-xl border p-4 space-y-4 ${
                m.completed         ? "border-green-800/60 bg-green-950/20"
                : canVote           ? "border-yellow-700/50 bg-yellow-950/10"
                : canFinalise       ? "border-orange-700/50 bg-orange-950/10"
                : canOpenVote       ? "border-indigo-700/50 bg-indigo-950/10"
                :                     "border-gray-800 bg-gray-900"
              }`}>

                {/* ── Header ─────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      m.completed    ? "bg-green-600 text-white"
                      : m.votingOpen ? "bg-yellow-500 text-gray-900"
                      : canOpenVote  ? "bg-indigo-600 text-white"
                      :                "bg-gray-700 text-gray-300"
                    }`}>
                      {m.completed ? "✓" : idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{m.title}</p>
                      <p className="text-xs text-indigo-400 font-medium mt-0.5">{fmt(m.amount)} payout</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold border ${
                    m.completed                     ? "bg-green-900/60 text-green-300 border-green-700"
                    : m.votingOpen && !votingEnded  ? "bg-yellow-900/60 text-yellow-300 border-yellow-700"
                    : votingEnded                   ? "bg-orange-900/60 text-orange-300 border-orange-700"
                    : canOpenVote                   ? "bg-indigo-900/60 text-indigo-300 border-indigo-700"
                    :                                 "bg-gray-800 text-gray-400 border-gray-700"
                  }`}>
                    {m.completed                    ? "✅ Paid Out"
                      : m.votingOpen && !votingEnded ? "🗳 Voting"
                      : votingEnded                  ? "⏱ Vote Ended"
                      : canOpenVote                  ? "Ready"
                      :                                "Pending"}
                  </span>
                </div>

                {/* ── Vote bar ───────────────────────────────────────── */}
                {(m.votingOpen || m.completed) && (
                  <div className="ml-11 space-y-1.5">
                    <div className="flex flex-wrap gap-x-4 text-xs">
                      <span className="text-green-400 font-medium">👍 {m.approvals.toString()} approve ({appPct}%)</span>
                      <span className="text-red-400 font-medium">👎 {m.rejections.toString()} reject ({rejPct}%)</span>
                      <span className="text-gray-500">{total} backers total</span>
                    </div>
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-700">
                      <div className="bg-green-500 transition-all duration-500" style={{ width: `${appPct}%` }} />
                      <div className="bg-red-500 transition-all duration-500" style={{ width: `${rejPct}%` }} />
                    </div>
                    <p className="text-xs text-gray-500">
                      Needs &gt;50% approval to release payment
                      {m.votingOpen && !votingEnded && ` · ${timeLeft(m.votingDeadline)} left`}
                      {votingEnded && " · Voting closed"}
                    </p>
                  </div>
                )}

                {/* ── Actions ────────────────────────────────────────── */}
                <div className="ml-11 space-y-2">

                  {/* STEP 2 — Creator opens the vote */}
                  {canOpenVote && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400">
                        Open a 3-day vote. If &gt;50% of backers approve, your payment is released automatically.
                      </p>
                      <button
                        disabled={!!busy}
                        onClick={() => send(`req-${idx}`, "requestMilestonePayout", [id, idx])}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white transition-colors"
                      >
                        {busy === `req-${idx}` ? <Spinner /> : "📣"}
                        Start Vote for This Milestone
                      </button>
                    </div>
                  )}

                  {/* STEP 3 — Backer votes */}
                  {canVote && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400">
                        You funded this campaign. Vote whether to approve the creator&apos;s payout:
                      </p>
                      <div className="flex gap-2">
                        <button
                          disabled={!!busy}
                          onClick={() => send(`yes-${idx}`, "vote", [id, idx, true])}
                          className="inline-flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white transition-colors"
                        >
                          {busy === `yes-${idx}` ? <Spinner /> : "👍"} Approve
                        </button>
                        <button
                          disabled={!!busy}
                          onClick={() => send(`no-${idx}`, "vote", [id, idx, false])}
                          className="inline-flex items-center gap-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white transition-colors"
                        >
                          {busy === `no-${idx}` ? <Spinner /> : "👎"} Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Non-backer info */}
                  {!isCreator && !isBacker && m.votingOpen && !votingEnded && (
                    <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2.5 text-xs text-gray-400">
                      🔒 You must fund this campaign to vote on milestone payouts.
                    </div>
                  )}

                  {/* STEP 4 — Finalise after voting */}
                  {canFinalise && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400">
                        Voting has ended.
                        {appPct > 50
                          ? " ✅ Majority approved — click below to release the payment."
                          : " ❌ Majority rejected — funds stay in escrow."}
                      </p>
                      <button
                        disabled={busy === `fin-${idx}`}
                        onClick={() => send(`fin-${idx}`, "finaliseVoting", [id, idx])}
                        className="inline-flex items-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white transition-colors"
                      >
                        {busy === `fin-${idx}` ? <Spinner /> : "⚡"}
                        Finalise Vote &amp; Release Payment
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
