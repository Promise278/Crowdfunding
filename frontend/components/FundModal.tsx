"use client";
import { useState } from "react";
import { ethers } from "ethers";
import { Btn, Input, Label, Modal, useToast } from "./ui";
import { sendContractTx, waitForTx } from "@/lib/contract";

export default function FundModal({ id, onDone }: { id: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [eth,  setEth]  = useState("");
  const [busy, setBusy] = useState(false);
  const { show, Toast } = useToast();

  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    const amt = parseFloat(eth);
    if (!eth || isNaN(amt) || amt <= 0) return show("Enter a valid ETH amount", "err");
    setBusy(true);
    try {
      const txHash = await sendContractTx("contribute", [id], ethers.parseEther(eth));
      show("⏳ Waiting for confirmation…");
      const receipt = await waitForTx(txHash);
      if (!receipt) throw new Error("Timed out.");
      show("🎉 Contribution sent!");
      setOpen(false);
      setEth("");
      onDone();
    } catch (err: unknown) {
      const raw    = err instanceof Error ? err.message : String(err);
      const reason = raw.match(/reason="([^"]+)"/)?.[1] ?? raw.slice(0, 150);
      show(reason, "err");
    } finally { setBusy(false); }
  }

  return (
    <>
      {Toast}
      <Btn onClick={() => setOpen(true)}>Fund This Campaign</Btn>
      {open && (
        <Modal title="Contribute ETH" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Amount (ETH)</Label>
              <Input type="number" step="any" min="0.000001" placeholder="0.1"
                value={eth} onChange={e => setEth(e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <Btn type="submit" loading={busy} className="flex-1">Send ETH</Btn>
              <Btn type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
