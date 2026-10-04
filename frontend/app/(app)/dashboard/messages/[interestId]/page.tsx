"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Send } from "lucide-react"

import { getThread, markRead, sendMessage, ThreadDetail } from "@/lib/messages"
import {
  DealTerms, DeliveryState, ReviewState, getDelivery, getReviews, getTerms,
} from "@/lib/deal-terms"
import DealTermsPanel from "@/components/dashboard/deal-terms-panel"
import DeliveryPanel from "@/components/dashboard/delivery-panel"
import SafetyMenu, { DisputeBanner } from "@/components/dashboard/safety-menu"
import { BlockState, Dispute, listDisputes } from "@/lib/trust"
import { errorMessage } from "@/lib/types"
import { useToast } from "@/components/ui/toast"

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  })
}

export default function ThreadPage() {
  const router = useRouter()
  const toast = useToast()
  const params = useParams<{ interestId: string }>()
  const interestId = Number(params.interestId)
  const [blockState, setBlockState] = useState<BlockState>({
    blocked: false, blocked_by_me: false,
  })
  const [disputes, setDisputes] = useState<Dispute[]>([])

  const [thread, setThread] = useState<ThreadDetail | null>(null)
  const [terms, setTerms] = useState<DealTerms | null>(null)
  const [delivery, setDelivery] = useState<DeliveryState | null>(null)
  const [reviews, setReviews] = useState<ReviewState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      try {
        // Both in flight at once — the terms panel and the messages render
        // together, so serialising them only adds a round trip.
        // All in flight at once — they render together, so serialising them
        // only adds round trips. Each deal panel is secondary: a failure in any
        // of them must not blank the conversation.
        const [data, dealTerms, dealDelivery, dealReviews] = await Promise.all([
          getThread(interestId),
          getTerms(interestId).catch(() => null),
          getDelivery(interestId).catch(() => null),
          getReviews(interestId).catch(() => null),
        ])
        setThread(data)
        setTerms(dealTerms)
        setDelivery(dealDelivery)
        setReviews(dealReviews)
        // Best-effort — an unread badge that doesn't clear is a cosmetic
        // issue, not one worth blocking the page load over.
        markRead(interestId).catch(() => {})
        listDisputes(interestId).then(setDisputes).catch(() => {})
      } catch (err) {
        setError(errorMessage(err, "Could not load this conversation."))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [interestId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [thread?.messages.length])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || !thread) return

    setSending(true)
    try {
      const message = await sendMessage(interestId, body)
      setThread({ ...thread, messages: [...thread.messages, message] })
      setDraft("")
    } catch (err) {
      toast.error(errorMessage(err, "Could not send that message."))
    } finally {
      setSending(false)
    }
  }

  const closed = thread?.interest_status !== "interested"

  return (
    <div className="relative flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-[-20%] left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-indigo-500/15 blur-[160px]" />
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
        <button
          onClick={() => router.push("/dashboard/messages")}
          className="mb-6 flex items-center gap-2 text-sm text-gray-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Messages
        </button>

        {loading && (
          <div className="flex flex-1 items-center justify-center">
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

        {thread && !loading && (
          <>
            <div className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-[#0E1220] to-[#080B14] p-5">
              <div>
                <h1 className="text-xl font-semibold text-white">{thread.counterpart.name}</h1>
                {thread.counterpart.subtitle && (
                  <p className="mt-0.5 text-sm text-gray-500">{thread.counterpart.subtitle}</p>
                )}
              </div>

              {/* In the conversation, beside their name — that is where
                  someone is standing when they decide they need it. */}
              <SafetyMenu
                interestId={interestId}
                counterpartName={thread.counterpart.name}
                onBlockChange={setBlockState}
              />
            </div>

            <DisputeBanner disputes={disputes} />

            {terms && (
              <div className="mb-6">
                <DealTermsPanel
                  interestId={interestId}
                  terms={terms}
                  onChange={(next) => {
                    setTerms(next)
                    // Accepting terms unlocks delivery, so re-read it.
                    getDelivery(interestId).then(setDelivery).catch(() => {})
                  }}
                  counterpartName={thread.counterpart.name}
                />

                {delivery && reviews && (
                  <div className="mt-4">
                    <DeliveryPanel
                      interestId={interestId}
                      delivery={delivery}
                      reviews={reviews}
                      onDeliveryChange={setDelivery}
                      onReviewsChange={setReviews}
                      counterpartName={thread.counterpart.name}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {thread.messages.length === 0 && (
                <p className="py-12 text-center text-sm text-gray-500">
                  No messages yet — say hello.
                </p>
              )}
              {thread.messages.map((m) => (
                <div key={m.id} className={`flex ${m.is_mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.is_mine
                        ? "bg-indigo-600 text-white"
                        : "border border-white/10 bg-white/5 text-gray-200"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p
                      className={`mt-1 text-[11px] ${
                        m.is_mine ? "text-indigo-200" : "text-gray-500"
                      }`}
                    >
                      {formatTime(m.created_at)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {closed ? (
              <p className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-gray-500">
                This interest was withdrawn — the conversation is closed.
              </p>
            ) : blockState.blocked ? (
              // Says which way the block runs. "You cannot send messages" with
              // no explanation reads as a bug, and the two cases have
              // different answers: one you can undo, the other you cannot.
              <p className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-gray-500">
                {blockState.blocked_by_me
                  ? "You blocked this conversation. Unblock from the shield menu to message again."
                  : `${thread.counterpart.name} has blocked messaging on this deal.`}
              </p>
            ) : (
              <form onSubmit={handleSend} className="mt-6 flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message…"
                  disabled={sending}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
