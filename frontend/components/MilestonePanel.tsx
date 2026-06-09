"use client";
import { useState } from "react";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import { Campaign, Milestone, sendContractTx, waitForTx } from "@/lib/contract";
import { fmt, timeLeft } from "@/lib/utils";
import { Btn, Card, Input, Label, useToast } from "./ui";

interface Props {
  id:         number;
  campaign:   Campaign;
  milestones: Milestone[];
  myAddr:     string;
  onRefresh:  () => void;
}

export default function MilestonePanel({ id, campaign, milestones, myAddr, onRefresh }: Props) {
  const { isConnected }   = useAccount();
  const { show, Toast }   = useToast();
  const [busy, setBusy]   = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm]   = useState({ title: "", amount: "" });

  const isCreator = !!myAddr && myAddr.toLowerCase() === campaign.creator.toLowerCase();

  async function run(label: string, method: string, args: unknown[], value?: bigint) {
    setBusy(label);
    try {
      const txHash = await sendContractTx(method, args, value);
      show("⏳ Waiting for confirmation…");
      const receipt = await waitForTx(txHash);
      if (!receipt) throw new Error("Timed out.");
      show("Done ✓");
      onRefresh();
    } catch (err: unknown) {
      const raw    = err instanceof Error ? err.message : String(err);
      const reason = raw.match(/reason="([^"]+)"/)?.[1] ?? raw.slice(0, 120);
      show(reason, "err");
    } finally { setBusy(null); }
  }

  async function addMilestone(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!form.title || !form.amount) return;
    await run("add", "addMilestone", [id, form.title, ethers.parseEther(form.amount)]);
    setForm({ title: "", amount: "" });
    setAddOpen(false);
  }

  return (
    <div className="p-4 space-y-4">
      {Toast}

      {isCreator && campaign.status <= 1 && (
        !addOpen ? (
          <Btn variant="outline" onClick={() => setAddOpen(true)}>+ Add Milestone</Btn>
        ) : (
          <Card className="p-4">
            <form onSubmit={addMilestone} className="space-y-3">
              <p className="text-sm font-medium text-white">New Milestone</p>
              <div>
                <Label>Title</Label>
                <Input placeholder="e.g. UI Design" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <Label>Payout (ETH)</Label>
                <Input type="number" step="any" min="0.001" placeholder="0.5" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="flex gap-2">
                <Btn type="submit" loading={busy === "add"} className="flex-1">Save</Btn>
                <Btn type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Btn>
              </div>
            </form>
          </Card>
        )
      )}

      {milestones.map((m, idx) => {
        const total      = Number(campaign.contributorCount);
        const appPct     = total ? Math.round((Number(m.approvals) / total) * 100) : 0;
        const votingEnded = m.votingOpen && Date.now() / 1000 > Number(m.votingDeadline);

        return (
          <Card key={idx} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-white">{m.title}</p>
                <p className="text-xs text-gray-400">{fmt(m.amount)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium border ${
                m.completed  ? "bg-green-900/40 text-green-400 border-green-800" :
                m.votingOpen ? "bg-yellow-900/40 text-yellow-400 border-yellow-800" :
                               "bg-gray-800 text-gray-400 border-gray-700"
              }`}>
                {m.completed ? "✓ Released" : m.votingOpen ? "🗳 Voting" : "Pending"}
              </span>
            </div>

            {(m.votingOpen || m.completed) && (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>✅ {m.approvals.toString()} approve ({appPct}%)</span>
                  <span>❌ {m.rejections.toString()} reject</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-700 overflow-hidden">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${appPct}%` }} />
                </div>
                {m.votingOpen && (
                  <p className="text-gray-500">
                    {votingEnded ? "Voting ended — ready to finalise" : `Ends ${timeLeft(m.votingDeadline)}`}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {isCreator && Number(campaign.status) === 1 && !m.votingOpen && !m.completed && (
                <Btn variant="outline" loading={busy === `req-${idx}`}
                  onClick={() => run(`req-${idx}`, "requestMilestonePayout", [id, idx])}>
                  Request Payout
                </Btn>
              )}
              {isConnected && !isCreator && m.votingOpen && !votingEnded && (
                <>
                  <Btn loading={busy === `yes-${idx}`}
                    onClick={() => run(`yes-${idx}`, "vote", [id, idx, true])}>
                    👍 Approve
                  </Btn>
                  <Btn variant="danger" loading={busy === `no-${idx}`}
                    onClick={() => run(`no-${idx}`, "vote", [id, idx, false])}>
                    👎 Reject
                  </Btn>
                </>
              )}
              {m.votingOpen && votingEnded && (
                <Btn variant="outline" loading={busy === `fin-${idx}`}
                  onClick={() => run(`fin-${idx}`, "finaliseVoting", [id, idx])}>
                  Finalise Vote
                </Btn>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
