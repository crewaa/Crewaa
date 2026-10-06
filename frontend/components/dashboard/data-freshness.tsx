"use client"

import { Clock, RefreshCw } from "lucide-react"

import { daysSince, parseApiDate, timeAgo } from "@/lib/time"

/** Matches REFRESH_AFTER_DAYS on the backend, where scheduled refreshes kick in. */
const STALE_AFTER_DAYS = 7

/**
 * "Data as of …" with a refresh action, shown above every analytics view so a
 * number is never read without knowing how old it is.
 */
export function DataFreshness({
  scrapedAt,
  onRefresh,
  refreshing,
  refreshLabel = "Refresh data",
}: {
  scrapedAt?: string | null
  onRefresh: () => void
  refreshing: boolean
  refreshLabel?: string
}) {
  const at = parseApiDate(scrapedAt)
  const stale = at ? daysSince(at) > STALE_AFTER_DAYS : false

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        stale ? "border-peacock-gold/30 bg-peacock-gold/[0.07]" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Clock className={`h-4 w-4 shrink-0 ${stale ? "text-peacock-gold" : "text-gray-400"}`} aria-hidden />
        {at ? (
          <p className="text-gray-300">
            Data as of <span className="text-white">{timeAgo(at)}</span>
            <span className="text-gray-500"> · {at.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
            {stale && (
              <span className="block text-peacock-gold sm:inline sm:pl-2">
                Over a week old. Refresh so brands see your latest numbers.
              </span>
            )}
          </p>
        ) : (
          <p className="text-gray-400">No data imported yet.</p>
        )}
      </div>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-peacock-teal px-4 py-2 text-sm font-semibold text-peacock-on-teal transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peacock-teal/60"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
        {refreshing ? "Importing…" : refreshLabel}
      </button>
    </div>
  )
}
