"use client";
import Link from "next/link";
import { Campaign, STATUS_COLOR, STATUS_LABEL } from "@/lib/contract";
import { fmt, fmtDate, pct, timeLeft } from "@/lib/utils";
import { Card, Progress } from "./ui";

export default function CampaignCard({ c, id }: { c: Campaign; id: number }) {
  const progress = pct(c.raised, c.goal);

  return (
    <Card className="flex flex-col gap-4 p-5 hover:border-indigo-600 transition-colors h-full">
      {/* header */}
      <div className="flex items-start justify-between gap-2">
        <Link href={`/campaign/${id}`} className="flex-1">
          <h3 className="font-semibold text-white line-clamp-2 leading-snug hover:text-indigo-400 transition-colors">
            {c.title}
          </h3>
        </Link>
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
      <div className="flex items-center justify-between pt-1 border-t border-gray-800">
        <div className="text-xs text-gray-500 space-y-0.5">
          <p>👥 {c.contributorCount.toString()} backers</p>
          <p>📅 {c.status === 0 ? timeLeft(c.deadline) : `Ended ${fmtDate(c.deadline)}`}</p>
        </div>

        {/* Fund button visible on card for active campaigns */}
        {c.status === 0 ? (
          <Link
            href={`/campaign/${id}`}
            onClick={e => e.stopPropagation()}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white transition-colors"
          >
            💰 Fund
          </Link>
        ) : (
          <Link
            href={`/campaign/${id}`}
            className="text-xs text-gray-500 hover:text-indigo-400 transition-colors"
          >
            View →
          </Link>
        )}
      </div>
    </Card>
  );
}
