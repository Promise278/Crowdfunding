"use client";
import { useState } from "react";
import { ethers } from "ethers";
import { useAccount } from "wagmi";
import { Btn, Input, Label, Modal, Textarea, useToast } from "./ui";
import { useWriteContract } from "@/lib/useContract";

export default function CreateCampaign({ onCreated }: { onCreated: () => void }) {
  const { isConnected } = useAccount();
  const getContract     = useWriteContract();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { show, Toast } = useToast();
  const [form, setForm] = useState({ title: "", desc: "", goal: "", days: "" });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!getContract)    return show("Connect your wallet first", "err");
    if (!form.title || !form.goal || !form.days) return show("Fill all fields", "err");

    setBusy(true);
    try {
      const cf = await getContract();
      const tx = await cf.createCampaign(
        form.title,
        form.desc,
        ethers.parseEther(form.goal),
        Number(form.days)
      );
      await tx.wait();
      show("Campaign created! 🎉");
      setOpen(false);
      setForm({ title: "", desc: "", goal: "", days: "" });
      onCreated();
    } catch (err: unknown) {
      const msg    = err instanceof Error ? err.message : "Transaction failed";
      const reason = msg.match(/reason="([^"]+)"/)?.[1]
                  ?? msg.match(/revert\s+(.+)/i)?.[1]
                  ?? msg.slice(0, 120);
      show(reason, "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {Toast}
      <Btn onClick={() => setOpen(true)} disabled={!isConnected}>
        + New Campaign
      </Btn>

      {open && (
        <Modal title="Create Campaign" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input placeholder="My awesome project" value={form.title} onChange={set("title")} required />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={3} placeholder="What are you building?" value={form.desc} onChange={set("desc")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Goal (ETH)</Label>
                <Input type="number" step="0.001" min="0.001" placeholder="1.0" value={form.goal} onChange={set("goal")} required />
              </div>
              <div>
                <Label>Duration (days)</Label>
                <Input type="number" min="1" max="365" placeholder="30" value={form.days} onChange={set("days")} required />
              </div>
            </div>
            <p className="text-xs text-gray-500">MetaMask will ask you to sign this transaction.</p>
            <div className="flex gap-2 pt-1">
              <Btn type="submit" loading={busy} className="flex-1">Create &amp; Sign</Btn>
              <Btn type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
