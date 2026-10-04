"use client"

/**
 * The admin trust & safety console (V2 Phase 3).
 *
 * Three queues on one page — reports, disputes, verifications — because they
 * are one job done by one person, and splitting them across three pages means
 * two of them get forgotten.
 *
 * Every queue is **oldest first**. Newest-first is the usual default and is
 * wrong here: it buries the item that has been waiting longest under every
 * fresh one, and that is precisely the report most likely to concern someone
 * still being harmed.
 */

import { useCallback, useEffect, useState } from "react"
import { Flag, Loader2, ShieldAlert, ShieldCheck } from "lucide-react"

import {
  AdminDispute, AdminReport, AdminVerification, TrustCounts,
  getTrustCounts, listAdminDisputes, listReports, listVerifications,
  resolveDispute, resolveReport, reviewVerification,
} from "@/lib/admin"
import { errorMessage } from "@/lib/types"
import { useToast } from "@/components/ui/toast"

type Tab = "reports" | "disputes" | "verifications"

function timeAgo(iso: string | null): string {
  if (!iso) return "—"
  const hours = (Date.now() - new Date(iso).getTime()) / 36e5
  if (hours < 1) return "under an hour ago"
  if (hours < 24) return `${Math.floor(hours)}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function AdminTrustPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>("reports")
  const [counts, setCounts] = useState<TrustCounts | null>(null)
  const [reports, setReports] = useState<AdminReport[]>([])
  const [disputes, setDisputes] = useState<AdminDispute[]>([])
  const [verifications, setVerifications] = useState<AdminVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, r, d, v] = await Promise.all([
        getTrustCounts(),
        listReports("open"),
        listAdminDisputes("open"),
        listVerifications(),
      ])
      setCounts(c)
      setReports(r)
      setDisputes(d)
      setVerifications(v)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
    // toast is stable from context; excluding it keeps this from re-running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  async function act(key: string, run: () => Promise<unknown>, done: string) {
    setBusyId(key)
    try {
      await run()
      toast.success(done)
      await load()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Flag; count: number }[] = [
    { id: "reports", label: "Reports", icon: Flag, count: counts?.reports?.open ?? 0 },
    { id: "disputes", label: "Disputes", icon: ShieldAlert, count: counts?.open_disputes ?? 0 },
    {
      id: "verifications", label: "Verifications", icon: ShieldCheck,
      count: counts?.pending_verifications ?? 0,
    },
  ]

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-white">Trust &amp; safety</h1>
      <p className="mt-1 text-sm text-gray-500">
        Oldest first — whatever has waited longest is at the top.
      </p>

      <div className="mt-6 flex gap-2">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition ${
              tab === id
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {count > 0 && (
              <span className="rounded-full bg-indigo-500 px-1.5 text-[11px] font-semibold text-white">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <p className="mt-10 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      )}

      {!loading && tab === "reports" && (
        <div className="mt-6 space-y-3">
          {reports.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-gray-500">
              Nothing waiting.
            </p>
          )}
          {reports.map((r) => (
            <article key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-white">
                  {r.reason.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-gray-500">{timeAgo(r.created_at)}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {r.reporter_email} reported {r.reported_email}
                {r.interest_id && ` · deal #${r.interest_id}`}
              </p>
              {r.detail && (
                <p className="mt-2 rounded-lg bg-black/30 p-3 text-sm leading-relaxed text-gray-300">
                  {r.detail}
                </p>
              )}

              <input
                value={notes[`r${r.id}`] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [`r${r.id}`]: e.target.value }))}
                placeholder="What you did about it (optional)"
                className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {(["actioned", "reviewed", "dismissed"] as const).map((status) => (
                  <button
                    key={status}
                    disabled={busyId === `r${r.id}`}
                    onClick={() => act(
                      `r${r.id}`,
                      () => resolveReport(r.id, status, notes[`r${r.id}`]),
                      `Report marked ${status}.`,
                    )}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white transition hover:bg-white/15 disabled:opacity-50"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && tab === "disputes" && (
        <div className="mt-6 space-y-3">
          {disputes.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-gray-500">
              Nothing waiting.
            </p>
          )}
          {disputes.map((d) => (
            <article key={d.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-white">Deal #{d.interest_id}</span>
                <span className="text-xs text-gray-500">{timeAgo(d.created_at)}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">Raised by {d.raised_by_email}</p>
              <p className="mt-2 rounded-lg bg-black/30 p-3 text-sm leading-relaxed text-gray-300">
                {d.detail}
              </p>

              <input
                value={notes[`d${d.id}`] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [`d${d.id}`]: e.target.value }))}
                placeholder="Outcome — both parties see this (required)"
                className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
              />

              <div className="mt-3 flex gap-2">
                {(["resolved", "dismissed"] as const).map((status) => (
                  <button
                    key={status}
                    // The note is required by the API too — a dispute that
                    // closes with no explanation tells whoever raised it they
                    // were overruled without saying why.
                    disabled={busyId === `d${d.id}` || (notes[`d${d.id}`] ?? "").trim().length < 5}
                    onClick={() => act(
                      `d${d.id}`,
                      () => resolveDispute(d.id, status, notes[`d${d.id}`]),
                      `Dispute ${status}.`,
                    )}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white transition hover:bg-white/15 disabled:opacity-40"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && tab === "verifications" && (
        <div className="mt-6 space-y-3">
          {verifications.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-gray-500">
              Nothing waiting.
            </p>
          )}
          {verifications.map((v) => (
            <article key={v.user_id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-white">{v.email}</span>
                <span className="text-xs text-gray-500">{timeAgo(v.requested_at)}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{v.role}</p>

              <input
                value={notes[`v${v.user_id}`] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [`v${v.user_id}`]: e.target.value }))}
                placeholder="Reason — required to reject, so they know what to fix"
                className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
              />

              <div className="mt-3 flex gap-2">
                <button
                  disabled={busyId === `v${v.user_id}`}
                  onClick={() => act(
                    `v${v.user_id}`,
                    () => reviewVerification(v.user_id, true),
                    "Account verified.",
                  )}
                  className="rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs text-white transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  approve
                </button>
                <button
                  disabled={
                    busyId === `v${v.user_id}` ||
                    !(notes[`v${v.user_id}`] ?? "").trim()
                  }
                  onClick={() => act(
                    `v${v.user_id}`,
                    () => reviewVerification(v.user_id, false, notes[`v${v.user_id}`]),
                    "Verification rejected.",
                  )}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white transition hover:bg-white/15 disabled:opacity-40"
                >
                  reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
