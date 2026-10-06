"use client"

import { ShieldCheck } from "lucide-react"

import { LEVEL_COPY, type AuthenticitySummary } from "@/lib/authenticity"

/**
 * Compact Authenticity Score for creator cards in brand screens.
 * Shows the score and level; `showReason` adds the most important finding.
 */
export function AuthenticityBadge({
  summary,
  showReason = false,
}: {
  summary?: AuthenticitySummary | null
  showReason?: boolean
}) {
  if (!summary) return null
  const copy = LEVEL_COPY[summary.level] ?? LEVEL_COPY.insufficient
  const reason = summary.highlights?.[0]

  return (
    <div className="min-w-0">
      <span
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs"
        title={[
          "Authenticity Score — an estimate from public data, not a verdict.",
          ...(summary.highlights ?? []),
        ].join("\n")}
      >
        <ShieldCheck className={`h-3.5 w-3.5 ${copy.tone}`} aria-hidden />
        {summary.score != null ? (
          <span className="font-semibold tabular-nums text-white">{summary.score}</span>
        ) : null}
        <span className={copy.tone}>{copy.label}</span>
      </span>
      {showReason && reason && <p className="mt-1.5 text-xs text-gray-400">{reason}</p>}
    </div>
  )
}
