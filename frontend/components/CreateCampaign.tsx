"use client";
import { useState } from "react";
import { ethers } from "ethers";
import { Btn, Input, Label, Modal, Textarea, useToast } from "./ui";
import { sendContractTx, waitForTx } from "@/lib/contract";

export default function CreateCampaign({ onCreated }: { onCreated: () => void }) {
  const [open,  setOpen]  = useState(false);
  const [busy,  setBusy]  = useState(false);
  const [debug, setDebug] = useState("");
  const { show, Toast }   = useToast();
  const [form, setForm]   = useState({ title: "", desc: "", goal: "", days: "" });

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!form.title || !form.goal || !form.days) return show("Fill all fields", "err");

    setBusy(true);
    setDebug("Requesting wallet…");

    try {
      // Step 1: send tx via MetaMask (signing only, no polling)
      setDebug("MetaMask signing — please approve…");
      const txHash = await sendContractTx(
        "createCampaign",
        [form.title, form.desc, ethers.parseEther(form.goal), Number(form.days)]
      );
      setDebug(`Tx sent: ${txHash.slice(0, 20)}… Waiting for confirmation…`);
      show("⏳ Transaction sent — waiting for confirmation…");

      // Step 2: wait using our own RPC (not MetaMask)
      const receipt = await waitForTx(txHash);
      if (!receipt) throw new Error("Transaction timed out — check Sepolia Etherscan.");

      setDebug(`✓ Confirmed in block ${receipt.blockNumber}`);
      show("🎉 Campaign created!");
      setOpen(false);
      setDebug("");
      setForm({ title: "", desc: "", goal: "", days: "" });
      onCreated();

    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : JSON.stringify(err);
      console.error("createCampaign error:", err);
      setDebug("Error: " + raw.slice(0, 300));
      const reason =
        raw.match(/reason="([^"]+)"/)?.[1] ??
        raw.match(/reverted with reason string '([^']+)'/)?.[1] ??
        raw.match(/"message":"([^"]+)"/)?.[1] ??
        raw.slice(0, 200);
      show(reason, "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {Toast}
      <Btn onClick={() => setOpen(true)}>+ New Campaign</Btn>

      {open && (
        <Modal title="Create Campaign" onClose={() => { setOpen(false); setDebug(""); }}>
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
                <Input type="number" step="any" min="0.001" placeholder="1.0"
                  value={form.goal} onChange={set("goal")} required />
              </div>
              <div>
                <Label>Duration (days)</Label>
                <Input type="number" min="1" max="365" placeholder="30"
                  value={form.days} onChange={set("days")} required />
              </div>
            </div>

            {debug && (
              <p className="rounded bg-gray-800 px-3 py-2 text-xs text-yellow-400 font-mono break-all">
                {debug}
              </p>
            )}

            <p className="text-xs text-gray-500">Your wallet will sign this on Sepolia.</p>
            <div className="flex gap-2 pt-1">
              <Btn type="submit" loading={busy} className="flex-1">Create &amp; Sign</Btn>
              <Btn type="button" variant="outline" onClick={() => { setOpen(false); setDebug(""); }}>Cancel</Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
