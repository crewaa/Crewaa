"use client"

/**
 * Delivery and reviews, shown under the terms panel once a deal is agreed
 * (V2 §1.4 and §1.5).
 *
 * Roles are asymmetric and the UI reflects that: a creator sees "submit work",
 * a brand sees "approve or ask for changes". Both are gated on the server's
 * `can_*` flags rather than on a locally guessed role, so the screen can never
 * offer a control the API would refuse.
 */

import { useState } from "react"
import {
  CheckCircle2, Clock, ExternalLink, Loader2, RotateCcw, Star, Upload, X,
} from "lucide-react"

import {
  Delivery, DeliveryState, ReviewState,
  getReviews, reviewDelivery, submitDelivery, submitReview,
} from "@/lib/deal-terms"
import { errorMessage } from "@/lib/types"
import { useToast } from "@/components/ui/toast"

const STATUS_LABEL: Record<Delivery["status"], string> = {
  submitted: "Awaiting review",
  approved: "Approved",
  changes_requested: "Changes requested",
  superseded: "Replaced",
}

const STATUS_STYLE: Record<Delivery["status"], string> = {
  submitted: "bg-amber-500/15 text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  changes_requested: "bg-red-500/15 text-red-300",
  superseded: "bg-white/5 text-gray-500",
}

function Stars({
  value, onChange, readOnly = false,
}: { value: number; onChange?: (n: number) => void; readOnly?: boolean }) {
  return (
    <div className="flex gap-1" role={readOnly ? "img" : "radiogroup"}
         aria-label={readOnly ? `${value} out of 5` : "Rating"}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          aria-checked={!readOnly && value === n}
          role={readOnly ? undefined : "radio"}
          onClick={() => onChange?.(n)}
          className={readOnly ? "cursor-default" : "cursor-pointer transition hover:scale-110"}
        >
          <Star
            className={`h-5 w-5 ${
              n <= value ? "fill-amber-400 text-amber-400" : "text-gray-600"
            }`}
          />
        </button>
      ))}
    </div>
  )
}

export default function DeliveryPanel({
  interestId,
  delivery,
  reviews,
  onDeliveryChange,
  onReviewsChange,
  counterpartName,
}: {
  interestId: number
  delivery: DeliveryState
  reviews: ReviewState
  onDeliveryChange: (next: DeliveryState) => void
  onReviewsChange: (next: ReviewState) => void
  counterpartName: string
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [url, setUrl] = useState("")
  const [note, setNote] = useState("")
  const [feedbackFor, setFeedbackFor] = useState<number | null>(null)
  const [feedback, setFeedback] = useState("")
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")

  // Nothing agreed yet — the terms panel above is still the whole story.
  if (!delivery.offer_id) return null

  async function act<T>(fn: () => Promise<T>, apply: (v: T) => void, ok?: string) {
    setBusy(true)
    try {
      apply(await fn())
      if (ok) toast.success(ok)
      return true
    } catch (err) {
      toast.error(errorMessage(err, "Could not update this."))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit(label: string) {
    if (!url.trim()) return
    const ok = await act(
      () => submitDelivery(interestId, { label, url: url.trim(), note: note.trim() || null }),
      onDeliveryChange,
      "Work submitted."
    )
    if (ok) {
      setSubmitting(null); setUrl(""); setNote("")
      // Delivery completing unlocks reviewing, so refresh that too.
      getReviews(interestId).then(onReviewsChange).catch(() => {})
    }
  }

  async function handleReview(id: number, approve: boolean) {
    const ok = await act(
      () => reviewDelivery(interestId, id, approve, approve ? undefined : feedback.trim()),
      onDeliveryChange,
      approve ? "Approved." : "Changes requested."
    )
    if (ok) {
      setFeedbackFor(null); setFeedback("")
      getReviews(interestId).then(onReviewsChange).catch(() => {})
    }
  }

  const live = delivery.submissions.filter((s) => s.status !== "superseded")

  return (
    <div className="space-y-4">
      {/* ---------------- Delivery ---------------- */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-300">Delivery</h2>
          {delivery.expected_count > 0 && (
            <span className={`rounded-full px-3 py-0.5 text-xs ${
              delivery.complete
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-white/5 text-gray-400"
            }`}>
              {delivery.complete
                ? "Complete"
                : `${delivery.approved_count} of ${delivery.expected_count} approved`}
            </span>
          )}
        </div>

        {live.length === 0 && !delivery.can_submit && (
          <p className="text-sm text-gray-500">
            Nothing submitted yet. {counterpartName} will post the work here.
          </p>
        )}

        {/* Submitted work */}
        {live.length > 0 && (
          <ul className="space-y-3">
            {live.map((s) => (
              <li key={s.id} className="rounded-xl border border-white/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white">{s.label}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs ${STATUS_STYLE[s.status]}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>

                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm text-indigo-400 transition hover:text-indigo-300 break-all"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {s.url}
                </a>

                {s.note && <p className="mt-2 text-sm text-gray-400 italic">&ldquo;{s.note}&rdquo;</p>}
                {s.feedback && (
                  <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {s.feedback}
                  </p>
                )}

                {/* Brand review controls */}
                {delivery.can_review && s.status === "submitted" && (
                  <div className="mt-3">
                    {feedbackFor === s.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="What needs changing?"
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            disabled={busy || !feedback.trim()}
                            onClick={() => handleReview(s.id, false)}
                            className="rounded-lg bg-red-600/80 px-4 py-2 text-sm text-white transition hover:bg-red-600 disabled:opacity-50"
                          >
                            Send feedback
                          </button>
                          <button
                            onClick={() => { setFeedbackFor(null); setFeedback("") }}
                            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-gray-400 transition hover:bg-white/5"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          disabled={busy}
                          onClick={() => handleReview(s.id, true)}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-emerald-950 transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Approve
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => setFeedbackFor(s.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Request changes
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Creator submit controls */}
        {delivery.can_submit && !!delivery.outstanding.length && (
          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Still to deliver</p>
            {delivery.outstanding.map((label) => (
              <div key={label}>
                {submitting === label ? (
                  <div className="space-y-2 rounded-xl border border-white/10 p-3">
                    <p className="text-sm font-medium text-white">{label}</p>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://instagram.com/p/..."
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Anything to mention (optional)"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={busy || !url.trim()}
                        onClick={() => handleSubmit(label)}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-indigo-950 transition hover:bg-indigo-500 disabled:opacity-50"
                      >
                        Submit
                      </button>
                      <button
                        onClick={() => { setSubmitting(null); setUrl(""); setNote("") }}
                        className="rounded-lg border border-white/15 px-4 py-2 text-sm text-gray-400 transition hover:bg-white/5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setSubmitting(label); setUrl(""); setNote("") }}
                    className="flex w-full items-center justify-between rounded-xl border border-dashed border-white/15 px-4 py-3 text-left text-sm text-gray-300 transition hover:border-white/30 hover:bg-white/5"
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-gray-500" /> {label}
                    </span>
                    <span className="flex items-center gap-1.5 text-indigo-400">
                      <Upload className="h-3.5 w-3.5" /> Submit
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------------- Reviews ---------------- */}
      {delivery.complete && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-4 text-sm font-medium text-gray-300">Reviews</h2>

          {reviews.mine ? (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                You rated {counterpartName}
              </p>
              <Stars value={reviews.mine.rating} readOnly />
              {reviews.mine.comment && (
                <p className="mt-2 text-sm text-gray-400 italic">
                  &ldquo;{reviews.mine.comment}&rdquo;
                </p>
              )}
            </div>
          ) : reviews.can_review ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                How was working with {counterpartName}?
              </p>
              <Stars value={rating} onChange={setRating} />
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional — what stood out?"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none"
              />
              <button
                disabled={busy || rating === 0}
                onClick={() =>
                  act(() => submitReview(interestId, rating, comment.trim() || undefined),
                      onReviewsChange, "Review submitted.")
                }
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-indigo-950 transition hover:bg-indigo-500 disabled:opacity-50"
              >
                Submit review
              </button>
              {/* Saying this up front is what makes people answer honestly. */}
              <p className="text-xs text-gray-500">
                Neither review is shown until you have both submitted.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">{reviews.blocked_reason}</p>
          )}

          {/* Theirs — only once revealed. */}
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
              {counterpartName}&rsquo;s review
            </p>
            {reviews.received ? (
              <>
                <Stars value={reviews.received.rating} readOnly />
                {reviews.received.comment && (
                  <p className="mt-2 text-sm text-gray-400 italic">
                    &ldquo;{reviews.received.comment}&rdquo;
                  </p>
                )}
              </>
            ) : (
              <p className="flex items-center gap-2 text-sm text-gray-500">
                <X className="h-3.5 w-3.5" />
                Hidden until you have both reviewed.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
