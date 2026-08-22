"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react"

import { listThreads, ThreadSummary } from "@/lib/messages"
import { errorMessage } from "@/lib/types"

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/**
 * Shared across both roles, same as /dashboard/profile — a brand's thread
 * shows the creator's identity, a creator's thread shows the brand's, and
 * the server decides which based on who's asking.
 */
export default function MessagesPage() {
  const router = useRouter()
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const data = await listThreads()
        setThreads(data)
      } catch (err) {
        setError(errorMessage(err, "Could not load your messages."))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-[-20%] left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-indigo-500/15 blur-[160px]" />
      </div>

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-12">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-8 flex items-center gap-2 text-sm text-gray-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>

        <h1 className="mb-3 text-4xl font-semibold tracking-tight md:text-5xl">Messages</h1>
        <p className="mb-10 text-lg text-gray-400">
          Conversations with brands and creators you&apos;ve connected with.
        </p>

        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            <span className="sr-only">Loading…</span>
          </div>
        )}

        {error && !loading && (
          <p
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </p>
        )}

        {!loading && !error && threads.length === 0 && (
          <div className="py-20 text-center">
            <MessageCircle className="mx-auto mb-4 h-10 w-10 text-gray-600" aria-hidden="true" />
            <p className="text-xl text-gray-400">No conversations yet</p>
            <p className="mt-2 text-sm text-gray-500">
              Once you send or receive a message on an interest, it&apos;ll show up here.
            </p>
          </div>
        )}

        {!loading && threads.length > 0 && (
          <div className="space-y-4">
            {threads.map((t) => (
              <button
                key={t.interest_id}
                onClick={() => router.push(`/dashboard/messages/${t.interest_id}`)}
                className="w-full rounded-2xl border border-white/10 bg-gradient-to-br from-[#0E1220] to-[#080B14] p-6 text-left transition hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">{t.counterpart.name}</h2>
                      {t.interest_status === "withdrawn" && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-gray-500">
                          Closed
                        </span>
                      )}
                    </div>
                    {t.counterpart.subtitle && (
                      <p className="mt-0.5 text-sm text-gray-500">{t.counterpart.subtitle}</p>
                    )}
                    {t.last_message && (
                      <p className="mt-2 truncate text-sm text-gray-400">{t.last_message}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {t.last_message_at && (
                      <span className="text-xs text-gray-500">{timeAgo(t.last_message_at)}</span>
                    )}
                    {t.unread_count > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1.5 text-xs font-medium text-white">
                        {t.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
