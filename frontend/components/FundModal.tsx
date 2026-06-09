"use client";
import { useState } from "react";
import { ethers } from "ethers";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Btn, Input, Label, Modal, useToast } from "./ui";
import { useWriteContract } from "@/lib/useContract";

interface Props {
  id:          number;
  isCreator:   boolean;
  isConnected: boolean;
  onDone:      () => void;
}

export default function FundModal({ id, isCreator, isConnected, onDone }: Props) {
  const getContract     = useWriteContract();
  const [open, setOpen] = useState(false);
  const [eth,  setEth]  = useState("");
  const [busy, setBusy] = useState(false);
  const { show, Toast } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!getContract) return show("Connect your wallet first", "err");
    if (!eth || isNaN(parseFloat(eth)) || parseFloat(eth) <= 0)
      return show("Enter a valid ETH amount", "err");

    setBusy(true);
    try {
      const cf = await getContract();
      const tx = await cf.contribute(id, { value: ethers.parseEther(eth) });
      await tx.wait();
      show("Contribution sent! 🎉");
      setOpen(false);
      setEth("");
      onDone();
    } catch (err: unknown) {
      const msg    = err instanceof Error ? err.message : "Transaction failed";
      const reason = msg.match(/reason="([^"]+)"/)?.[1]
                  ?? msg.match(/revert\s+(.+)/i)?.[1]
                  ?? msg.slice(0, 120);
      show(reason, "err");
    } finally { setBusy(false); }
  }

  return (
    <>
      {Toast}

      {/* Always visible Fund button */}
      <Btn onClick={() => setOpen(true)}>
        💰 Fund This Campaign
      </Btn>

      {open && (
        <Modal title="Fund This Campaign" onClose={() => setOpen(false)}>

          {/* Not connected — prompt to connect */}
          {!isConnected ? (
            <div className="space-y-4 text-center py-2">
              <p className="text-gray-400 text-sm">Connect your wallet to contribute ETH to this campaign.</p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>
          ) : isCreator ? (
            /* Creator can't fund their own campaign */
            <div className="py-4 text-center">
              <p className="text-yellow-400 text-sm">You are the creator of this campaign and cannot fund it yourself.</p>
              <Btn variant="outline" className="mt-4" onClick={() => setOpen(false)}>Close</Btn>
            </div>
          ) : (
            /* Connected non-creator — show contribution form */
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Amount (ETH)</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="0.1"
                  value={eth}
                  onChange={e => setEth(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-gray-500">MetaMask will ask you to confirm this transaction on Sepolia.</p>
              <div className="flex gap-2">
                <Btn type="submit" loading={busy} className="flex-1">Send ETH</Btn>
                <Btn type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Btn>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
