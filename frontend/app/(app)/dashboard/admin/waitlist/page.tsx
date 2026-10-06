"use client"

/**
 * Waitlist sign-ups for parts that have not launched (V3 Phase 3).
 * Newest first — this is a list to read and export, not a queue to work.
 */

import { useEffect, useState } from "react"
import { Download, Inbox, Loader2 } from "lucide-react"

import { listWaitlist, WAITLIST_LABEL, type WaitlistEntry } from "@/lib/waitlist"
import { parseApiDate, timeAgo } from "@/lib/time"
import { errorMessage } from "@/lib/types"

function toCsv(rows: WaitlistEntry[]): string {
  const cell = (v: string | number | null) => {
    const s = v == null ? "" : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = ["product", "email", "name", "company", "user_id", "joined_at"]
  return [head.join(","), ...rows.map((r) =>
    [r.product, r.email, r.name, r.company, r.user_id, parseApiDate(r.created_at)?.toISOString() ?? r.created_at].map(cell).join(",")
  )].join("\n")
}

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    listWaitlist()
      .then((res) => setEntries(res.entries))
      .catch((err) => setError(errorMessage(err)))
  }, [])

  function download() {
    if (!entries) return
    const url = URL.createObjectURL(new Blob([toCsv(entries)], { type: "text/csv" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `crewaa-waitlist-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-part-ai">AI Influencers</p>
          <h1 className="mt-1 font-display text-3xl font-medium text-white">Waitlist</h1>
          <p className="mt-2 text-sm text-gray-400">
            People who asked to hear when AI Influencers opens.
            {entries && <> <span className="text-white tabular-nums">{entries.length}</span> so far.</>}
          </p>
        </div>
        <button
          onClick={download}
          disabled={!entries?.length}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-peacock-surface px-4 py-2.5 text-sm text-white transition hover:border-white/20 disabled:opacity-40"
        >
          <Download className="h-4 w-4" aria-hidden /> Export CSV
        </button>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-peacock-surface">
        {error ? (
          <p className="p-8 text-sm text-peacock-danger">{error}</p>
        ) : entries == null ? (
          <div className="flex items-center gap-3 p-8 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <Inbox className="h-8 w-8 text-gray-600" aria-hidden />
            <p className="text-sm text-gray-400">No one has joined yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Company</th>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">Account</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.map((e) => {
                  const joined = parseApiDate(e.created_at)
                  return (
                    <tr key={e.id} className="text-gray-200">
                      <td className="px-5 py-3.5 text-white">{e.email}</td>
                      <td className="px-5 py-3.5">{e.company || <span className="text-gray-600">—</span>}</td>
                      <td className="px-5 py-3.5">{WAITLIST_LABEL[e.product] ?? e.product}</td>
                      <td className="px-5 py-3.5">
                        {e.user_id ? <span className="text-peacock-teal">Signed up</span> : <span className="text-gray-500">Visitor</span>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400" title={joined?.toLocaleString()}>{joined ? timeAgo(joined) : "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
