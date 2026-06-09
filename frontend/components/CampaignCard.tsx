"use client";
import Link from "next/link";
import { Campaign, STATUS_COLOR, STATUS_LABEL } from "@/lib/contract";
import { fmt, fmtDate, pct, timeLeft } from "@/lib/utils";
import { Card, Progress } from "./ui";

export default function CampaignCard({ c, id }: { c: Campaign; id: number }) {
  const progress = pct(c.raised, c.goal);

  return (
    <Link href={`/campaign/${id}`}>
      <Card className="flex flex-col gap-4 p-5 hover:border-indigo-600 transition-colors cursor-pointer h-full">
        {/* header */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-white line-clamp-2 leading-snug">{c.title}</h3>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status]}`}>
            {STATUS_LABEL[c.status]}
          </span>
        </div>

        {/* description */}
        <p className="text-sm text-gray-400 line-clamp-2 flex-1">{c.description || "No description."}</p>

        {/* progress */}
        <div className="space-y-1.5">
          <Progress pct={progress} />
          <div className="flex justify-between text-xs text-gray-400">
            <span className="text-indigo-400 font-medium">{fmt(c.raised)}</span>
            <span>{progress}% of {fmt(c.goal)}</span>
          </div>
        </div>

        {/* footer */}
        <div className="flex justify-between text-xs text-gray-500 pt-1 border-t border-gray-800">
          <span>👥 {c.contributorCount.toString()} backers</span>
          <span>📅 {c.status === 0 ? timeLeft(c.deadline) : `Ended ${fmtDate(c.deadline)}`}</span>
        </div>
      </Card>
    </Link>
  );
}
