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

/* ── tiny helpers ──────────────────────────────────────────────────────── */
function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block" />;
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2.5 text-xs text-gray-400">
      {children}
    </div>
  );
}

export default function MilestonePanel({ id, campaign, milestones, myAddr, isBacker, onRefresh }: Props) {
  const { show, Toast } = useToast();
  const [busy,    setBusy]    = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form,    setForm]    = useState({ title: "", amount: "" });
  const [debug,   setDebug]   = useState("");

  const isCreator = !!myAddr && myAddr.toLowerCase() === campaign.creator.toLowerCase();
  const status    = Number(campaign.status);
  // 0=Active, 1=Successful, 2=Failed, 3=Completed

  async function send(label: string, method: string, args: unknown[], value?: bigint) {
    setBusy(label);
    setDebug("Sending — approve in MetaMask…");
    try {
      const hash = await sendContractTx(method, args, value);
      setDebug("Waiting for block confirmation…");
      const receipt = await waitForTx(hash);
      if (!receipt) throw new Error("Timed out.");
      setDebug("");
      show("✅ Done!");
      onRefresh();
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      const msg = raw.match(/reason="([^"]+)"/)?.[1]
               ?? raw.match(/reverted with reason string '([^']+)'/)?.[1]
               ?? raw.slice(0, 150);
      setDebug("❌ " + raw.slice(0, 200));
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

  return (
    <div className="space-y-5 p-4">
      {Toast}

      {/* tx debug strip */}
      {debug && (
        <div className="rounded-lg bg-gray-800 border border-yellow-600/30 px-3 py-2 text-xs text-yellow-400 font-mono break-all">
          {debug}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          CREATOR VIEW
          Steps: Add Milestone → Open Vote → Wait → Receive Payment
         ════════════════════════════════════════════════════════════════ */}
      {isCreator && (
        <div className="space-y-4">

          {/* ── Step guide bar ────────────────────────────────────────── */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-3">
            <p className="text-xs font-semibold text-gray-300 mb-2">Your milestone workflow:</p>
            <div className="flex gap-1 text-xs text-gray-500">
              {[
                { n: 1, label: "Add milestone",    done: milestones.length > 0 },
                { n: 2, label: "Open vote",        done: milestones.some(m => m.votingOpen || m.completed) },
                { n: 3, label: "Backers vote",     done: milestones.some(m => m.completed) },
                { n: 4, label: "Receive payment",  done: milestones.some(m => m.completed) },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    s.done ? "bg-green-600 text-white" : "bg-gray-700 text-gray-400"
                  }`}>
                    {s.done ? "✓" : s.n}
                  </div>
                  <span className={s.done ? "text-green-400" : ""}>{s.label}</span>
                  {i < 3 && <span className="text-gray-700 mx-0.5">→</span>}
                </div>
              ))}
            </div>
          </div>

          {/* ── STEP 1: Add milestone (Active or Successful) ─────────── */}
          {status <= 1 && (
            <div>
              {!addOpen ? (
                <button
                  onClick={() => setAddOpen(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-700 hover:border-indigo-500 py-5 text-sm text-gray-400 hover:text-indigo-300 transition-colors"
                >
                  <span className="text-xl leading-none">+</span>
                  Create New Milestone
                </button>
              ) : (
                <div className="rounded-xl border border-indigo-600/40 bg-indigo-950/20 p-4 space-y-3">
                  <p className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">1</span>
                    New Milestone
                  </p>
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
                        className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-2 text-sm font-semibold text-white transition-colors">
                        {busy === "add" ? <Spinner /> : null} Save Milestone
                      </button>
                      <button type="button" onClick={() => setAddOpen(false)}
                        className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Request payout vote (only when Successful) ───── */}
          {status === 0 && milestones.length > 0 && (
            <InfoBox>
              💡 Campaign must reach its goal and be finalised as <span className="text-green-400 font-medium">Successful</span> before you can open voting on milestones.
            </InfoBox>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MILESTONE LIST (everyone sees this)
         ════════════════════════════════════════════════════════════════ */}
      {milestones.length === 0 ? (
        <div className="rounded-xl border border-gray-800 py-10 text-center">
          <p className="text-2xl mb-2">🏁</p>
          <p className="text-sm text-gray-400">No milestones yet.</p>
          {!isCreator && <p className="text-xs text-gray-600 mt-1">The campaign creator hasn&apos;t added any milestones.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {milestones.map((m, idx) => {
            const total       = Number(campaign.contributorCount);
            const appPct      = total ? Math.round((Number(m.approvals) / total) * 100) : 0;
            const rejPct      = total ? Math.round((Number(m.rejections) / total) * 100) : 0;
            const votingEnded = m.votingOpen && Date.now() / 1000 > Number(m.votingDeadline);

            // creator opens voting — only when campaign is Successful
            const canOpenVote = isCreator && status === 1 && !m.votingOpen && !m.completed;
            // backer casts vote
            const canVote     = isBacker && !isCreator && m.votingOpen && !votingEnded;
            // anyone finalises after voting window
            const canFinalise = m.votingOpen && votingEnded;

            return (
              <div key={idx} className={`rounded-xl border p-4 space-y-3 transition-colors ${
                m.completed         ? "border-green-800/60 bg-green-950/20"
                : canVote           ? "border-yellow-700/60 bg-yellow-950/10"
                : canFinalise       ? "border-orange-700/60 bg-orange-950/10"
                : canOpenVote       ? "border-indigo-700/60 bg-indigo-950/10"
                :                     "border-gray-800 bg-gray-900"
              }`}>
                {/* header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      m.completed ? "bg-green-600 text-white"
                      : m.votingOpen ? "bg-yellow-500 text-gray-900"
                      : "bg-gray-700 text-gray-300"
                    }`}>
                      {m.completed ? "✓" : idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{m.title}</p>
                      <p className="text-xs text-indigo-400 font-medium mt-0.5">{fmt(m.amount)} payout</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold border ${
                    m.completed         ? "bg-green-900/60 text-green-300 border-green-700"
                    : m.votingOpen && !votingEnded ? "bg-yellow-900/60 text-yellow-300 border-yellow-700 animate-pulse"
                    : votingEnded       ? "bg-orange-900/60 text-orange-300 border-orange-700"
                    : canOpenVote       ? "bg-indigo-900/60 text-indigo-300 border-indigo-700"
                    :                     "bg-gray-800 text-gray-400 border-gray-700"
                  }`}>
                    {m.completed              ? "✅ Funds Released"
                      : m.votingOpen && !votingEnded ? "🗳 Voting Open"
                      : votingEnded           ? "⏱ Vote Ended"
                      : canOpenVote           ? "💬 Ready to Vote"
                      :                         "⏳ Pending"}
                  </span>
                </div>

                {/* voting bar */}
                {(m.votingOpen || m.completed) && (
                  <div className="ml-11 space-y-2">
                    <div className="flex flex-wrap gap-x-3 text-xs">
                      <span className="text-green-400">✅ {m.approvals.toString()} approve ({appPct}%)</span>
                      <span className="text-red-400">❌ {m.rejections.toString()} reject ({rejPct}%)</span>
                      <span className="text-gray-500">{total} backers</span>
                    </div>
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-700">
                      <div className="bg-green-500 transition-all" style={{ width: `${appPct}%` }} />
                      <div className="bg-red-500 transition-all" style={{ width: `${rejPct}%` }} />
                    </div>
                    <p className="text-xs text-gray-500">
                      &gt;50% of all backers must approve for payout
                      {m.votingOpen && !votingEnded && ` · ${timeLeft(m.votingDeadline)} remaining`}
                      {votingEnded && " · Voting window closed"}
                    </p>
                  </div>
                )}

                {/* action area */}
                <div className="ml-11 space-y-2">

                  {/* CREATOR: open voting */}
                  {canOpenVote && (
                    <>
                      <p className="text-xs text-gray-400">
                        Open a 3-day voting window. Backers will approve or reject this payout.
                      </p>
                      <button
                        disabled={!!busy}
                        onClick={() => send(`req-${idx}`, "requestMilestonePayout", [id, idx])}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white transition-colors"
                      >
                        {busy === `req-${idx}` ? <Spinner /> : "📣"}
                        Open Payout Vote
                      </button>
                    </>
                  )}

                  {/* BACKERS: vote */}
                  {canVote && (
                    <>
                      <p className="text-xs text-gray-400">You backed this campaign — cast your vote:</p>
                      <div className="flex gap-2">
                        <button
                          disabled={!!busy}
                          onClick={() => send(`yes-${idx}`, "vote", [id, idx, true])}
                          className="inline-flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white transition-colors"
                        >
                          {busy === `yes-${idx}` ? <Spinner /> : "👍"} Approve Payout
                        </button>
                        <button
                          disabled={!!busy}
                          onClick={() => send(`no-${idx}`, "vote", [id, idx, false])}
                          className="inline-flex items-center gap-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white transition-colors"
                        >
                          {busy === `no-${idx}` ? <Spinner /> : "👎"} Reject Payout
                        </button>
                      </div>
                    </>
                  )}

                  {/* Non-backer locked out */}
                  {!isCreator && !isBacker && m.votingOpen && !votingEnded && (
                    <InfoBox>
                      🔒 Only backers who funded this campaign can vote.<br />
                      <span className="text-gray-500">Contribute ETH to unlock voting rights.</span>
                    </InfoBox>
                  )}

                  {/* Finalise after voting window */}
                  {canFinalise && (
                    <>
                      <p className="text-xs text-gray-400">
                        Voting is over. Finalise to release funds to creator (if approved) or keep in escrow (if rejected).
                      </p>
                      <button
                        disabled={busy === `fin-${idx}`}
                        onClick={() => send(`fin-${idx}`, "finaliseVoting", [id, idx])}
                        className="inline-flex items-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white transition-colors"
                      >
                        {busy === `fin-${idx}` ? <Spinner /> : "⚡"} Finalise &amp; Release
                      </button>
                    </>
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
