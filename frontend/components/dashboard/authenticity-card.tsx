"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Instagram, MinusCircle, ShieldCheck, XCircle, Youtube } from "lucide-react"

import {
  LEVEL_COPY,
  getAuthenticity,
  type AuthenticityPlatformReport,
  type AuthenticityReportResponse,
  type SignalStatus,
} from "@/lib/authenticity"
import { parseApiDate, timeAgo } from "@/lib/time"

const STATUS_ICON: Record<SignalStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
  good: { icon: CheckCircle2, className: "text-peacock-ok", label: "Looks normal" },
  warn: { icon: AlertTriangle, className: "text-peacock-gold", label: "Worth a look" },
  bad: { icon: XCircle, className: "text-peacock-danger", label: "Concern" },
  unknown: { icon: MinusCircle, className: "text-gray-500", label: "Not enough data" },
}

function ScoreRing({ score, color }: { score: number | null; color: string }) {
  const pct = score ?? 0
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1C3B43" strokeWidth="3" />
        {score != null && (
          <circle
            cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
            pathLength={100} strokeDasharray={`${pct} 100`}
            className="transition-[stroke-dasharray] duration-1000 ease-out"
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-3xl text-white tabular-nums">
        {score ?? "–"}
      </span>
    </div>
  )
}

function PlatformReport({ report }: { report: AuthenticityPlatformReport }) {
  const copy = LEVEL_COPY[report.level] ?? LEVEL_COPY.insufficient
  const at = parseApiDate(report.computed_at)
  const Icon = report.platform === "youtube" ? Youtube : Instagram

  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-peacock-surface/60 p-5">
      <div className="flex items-center gap-4">
        <ScoreRing score={report.score} color={copy.ring} />
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-gray-400">
            <Icon className="h-4 w-4" aria-hidden />
            {report.platform === "youtube" ? "YouTube" : "Instagram"}
          </p>
          <p className={`mt-1 text-lg font-semibold ${copy.tone}`}>{copy.label}</p>
          {at && <p className="text-xs text-gray-500">Checked {timeAgo(at)}</p>}
        </div>
      </div>

      <ul className="mt-5 divide-y divide-white/[0.06] border-t border-white/[0.06]">
        {report.signals.map((s) => {
          const st = STATUS_ICON[s.status] ?? STATUS_ICON.unknown
          const SIcon = st.icon
          return (
            <li key={s.key} className="flex gap-3 py-3">
              <SIcon className={`mt-0.5 h-4 w-4 shrink-0 ${st.className}`} aria-label={st.label} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-medium text-white">{s.label}</span>
                  {s.value && <span className="text-xs tabular-nums text-gray-400">{s.value}</span>}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{s.detail}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Full Authenticity Score for one creator, per platform, with every check and
 * its reason. Used on the creator's own analytics page (`viewer="creator"`)
 * and on a creator's profile as a brand sees it (`viewer="brand"`).
 */
export function AuthenticityCard({ userId, viewer = "creator" }: { userId: number; viewer?: "creator" | "brand" }) {
  const [data, setData] = useState<AuthenticityReportResponse | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    getAuthenticity(userId)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-peacock-surface to-peacock-deep p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-medium text-white md:text-3xl">
            <ShieldCheck className="h-6 w-6 text-peacock-teal" aria-hidden />
            Authenticity Score
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            {viewer === "brand"
              ? "Checks this creator's public numbers for patterns that are common with fake followers, bought likes and bot comments."
              : "Brands see this score next to your profile. It checks your public numbers for patterns that are common with fake followers, bought likes and bot comments."}
          </p>
        </div>
      </div>

      <div className="mt-6">
        {error && <p className="text-sm text-gray-400">Your Authenticity Score could not be loaded. Refresh the page to try again.</p>}
        {!error && !data && <div className="h-40 animate-pulse rounded-2xl bg-white/[0.03]" aria-busy="true" />}
        {data && data.reports.length === 0 && (
          <p className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-gray-400">
            Import your Instagram or YouTube data below and your Authenticity Score will appear here.
          </p>
        )}
        {data && data.reports.length > 0 && (
          <div className={`grid gap-4 ${data.reports.length > 1 ? "lg:grid-cols-2" : ""}`}>
            {data.reports.map((r) => (
              <PlatformReport key={r.platform} report={r} />
            ))}
          </div>
        )}
        {data && data.reports.length > 0 && <p className="mt-4 text-xs text-gray-500">{data.disclaimer}</p>}
      </div>
    </section>
  )
}
