"use client"

/**
 * Deal terms, shown inside the message thread (V2 §1.2).
 *
 * It lives here rather than on its own page because negotiating a fee *is* the
 * conversation — sending someone to a different screen to counter an offer, and
 * back again to explain why, is two places to hold one discussion.
 *
 * Every control is gated on the server's `can_*` flags rather than on locally
 * inferred state, so the UI cannot offer a button the API would reject.
 */

import { useState } from "react"
import {
  CalendarDays, Check, CircleSlash, Handshake, Loader2, Pencil, X,
} from "lucide-react"

import {
  DealTerms, Offer, formatFee, proposeTerms, respondToOffer,
} from "@/lib/deal-terms"
import { errorMessage } from "@/lib/types"
import { useToast } from "@/components/ui/toast"
import { PaymentStatus } from "./payment-status"

function formatDate(iso?: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  })
}

/** One set of terms, rendered the same whether live, agreed or historical. */
function Terms({ offer, muted = false }: { offer: Offer; muted?: boolean }) {
  const deadline = formatDate(offer.deadline)

  return (
    <div className={muted ? "opacity-60" : ""}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold text-white">
          {formatFee(offer.fee, offer.currency)}
        </span>
        {deadline && (
          <span className="flex items-center gap-1 text-sm text-gray-400">
            <CalendarDays className="h-3.5 w-3.5" /> by {deadline}
          </span>
        )}
      </div>

      {!!offer.deliverables?.length && (
        <ul className="mt-3 space-y-1">
          {offer.deliverables.map((d, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
              {d}
            </li>
          ))}
        </ul>
      )}

      {offer.note && (
        <p className="mt-3 text-sm text-gray-400 italic">&ldquo;{offer.note}&rdquo;</p>
      )}
    </div>
  )
}

export default function DealTermsPanel({
  interestId,
  terms,
  onChange,
  counterpartName,
}: {
  interestId: number
  terms: DealTerms
  onChange: (next: DealTerms) => void
  counterpartName: string
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [composing, setComposing] = useState(false)
  const [fee, setFee] = useState("")
  const [deadline, setDeadline] = useState("")
  const [deliverableDraft, setDeliverableDraft] = useState("")
  const [deliverables, setDeliverables] = useState<string[]>([])
  const [note, setNote] = useState("")

  const { current, agreed } = terms

  async function act(fn: () => Promise<DealTerms>, successMessage?: string) {
    setBusy(true)
    try {
      onChange(await fn())
      if (successMessage) toast.success(successMessage)
      return true
    } catch (err) {
      // A 409 means the other side moved while this page was open. Saying so
      // plainly beats a generic failure, because the fix is "reload".
      toast.error(errorMessage(err, "Could not update the terms."))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault()
    if (!fee.trim()) return

    const ok = await act(
      () => proposeTerms(interestId, {
        fee: fee.trim(),
        deadline: deadline || null,
        deliverables: deliverables.length ? deliverables : null,
        note: note.trim() || null,
      }),
      current ? "Counter-offer sent." : "Terms proposed."
    )

    if (ok) {
      setComposing(false)
      setFee(""); setDeadline(""); setDeliverables([]); setNote("")
    }
  }

  function addDeliverable() {
    const value = deliverableDraft.trim()
    if (!value) return
    setDeliverables((prev) => [...prev, value])
    setDeliverableDraft("")
  }

  /** What was proposed before, kept verbatim. Shown in every state. */
  const history = terms.history.length ? (
    <details className="mt-5 border-t border-white/10 pt-4">
      <summary className="cursor-pointer text-xs text-gray-500 transition hover:text-gray-300">
        Previous offers ({terms.history.length})
      </summary>
      <div className="mt-3 space-y-4">
        {terms.history.map((offer) => (
          <div key={offer.id} className="rounded-xl border border-white/5 p-3">
            <p className="mb-2 text-xs text-gray-500">
              {offer.is_mine ? "You" : counterpartName} ·{" "}
              <span className="capitalize">{offer.status}</span> ·{" "}
              {formatDate(offer.created_at)}
            </p>
            <Terms offer={offer} muted />
          </div>
        ))}
      </div>
    </details>
  ) : null

  // ---- Agreed: the record both sides rely on. Nothing further is offered. ----
  if (agreed) {
    return (
      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-300">
          <Handshake className="h-4 w-4" /> Terms agreed
        </h2>
        <Terms offer={agreed} />
        <p className="mt-4 text-xs text-gray-500">
          Agreed {formatDate(agreed.responded_at)} · these terms are fixed and
          cannot be edited.
        </p>
        {/* Said here, at the moment a fee is agreed, rather than later in the
            delivery flow — this is the point at which someone forms an
            expectation about getting paid. */}
        <PaymentStatus fee={formatFee(agreed.fee, agreed.currency)} />
        {/* The history stays visible after agreement. Hiding it here would
            waste the whole point of keeping offers immutable: "what did we
            actually discuss before this" is most often asked *after* a deal
            is struck, not during. */}
        {history}
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="mb-4 text-sm font-medium text-gray-300">Deal terms</h2>

      {/* ---- Nothing on the table yet ---- */}
      {!current && !composing && (
        <div>
          <p className="text-sm text-gray-400">
            No terms proposed yet. Agreeing a fee, deliverables and a deadline
            here keeps both sides looking at the same thing.
          </p>
          {terms.can_propose && (
            <button
              onClick={() => setComposing(true)}
              className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Propose terms
            </button>
          )}
        </div>
      )}

      {/* ---- A live offer ---- */}
      {current && !composing && (
        <div>
          <p className="mb-3 text-xs uppercase tracking-wide text-gray-500">
            {current.is_mine ? "You proposed" : `${counterpartName} proposed`}
          </p>
          <Terms offer={current} />

          <div className="mt-5 flex flex-wrap gap-2">
            {terms.can_respond && (
              <>
                <button
                  disabled={busy}
                  onClick={() =>
                    act(() => respondToOffer(interestId, current.id, "accept"),
                        "Terms agreed.")
                  }
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Accept
                </button>
                <button
                  disabled={busy}
                  onClick={() => setComposing(true)}
                  className="flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-sm text-gray-200 transition hover:bg-white/5 disabled:opacity-50"
                >
                  <Pencil className="h-4 w-4" /> Counter
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    act(() => respondToOffer(interestId, current.id, "decline"),
                        "Offer declined.")
                  }
                  className="flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-sm text-gray-400 transition hover:bg-white/5 disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> Decline
                </button>
              </>
            )}

            {terms.can_withdraw && (
              <button
                disabled={busy}
                onClick={() =>
                  act(() => respondToOffer(interestId, current.id, "withdraw"),
                      "Offer withdrawn.")
                }
                className="flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-sm text-gray-400 transition hover:bg-white/5 disabled:opacity-50"
              >
                <CircleSlash className="h-4 w-4" /> Withdraw
              </button>
            )}
          </div>

          {terms.can_withdraw && (
            <p className="mt-3 text-xs text-gray-500">
              Waiting on {counterpartName} to respond.
            </p>
          )}
        </div>
      )}

      {/* ---- Proposing or countering ---- */}
      {composing && (
        <form onSubmit={handlePropose} className="space-y-4">
          <div>
            <label htmlFor="fee" className="mb-1.5 block text-sm text-gray-300">
              Fee (₹) *
            </label>
            <input
              id="fee"
              type="number"
              min="1"
              step="0.01"
              required
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="30000"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="deadline" className="mb-1.5 block text-sm text-gray-300">
              Deadline
            </label>
            <input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-indigo-500/50 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="deliverable" className="mb-1.5 block text-sm text-gray-300">
              Deliverables
            </label>
            <div className="flex gap-2">
              <input
                id="deliverable"
                type="text"
                value={deliverableDraft}
                onChange={(e) => setDeliverableDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter adds a deliverable; it must not submit the whole form.
                  if (e.key === "Enter") { e.preventDefault(); addDeliverable() }
                }}
                placeholder="1x Reel (45s)"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={addDeliverable}
                className="rounded-xl border border-white/15 px-4 text-sm text-gray-200 transition hover:bg-white/5"
              >
                Add
              </button>
            </div>
            {!!deliverables.length && (
              <ul className="mt-2 space-y-1">
                {deliverables.map((d, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5 text-sm text-gray-300">
                    {d}
                    <button
                      type="button"
                      aria-label={`Remove ${d}`}
                      onClick={() => setDeliverables((p) => p.filter((_, j) => j !== i))}
                      className="text-gray-500 transition hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="note" className="mb-1.5 block text-sm text-gray-300">
              Note
            </label>
            <textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything worth saying about these terms"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:outline-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !fee.trim()}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {current ? "Send counter-offer" : "Propose terms"}
            </button>
            <button
              type="button"
              onClick={() => setComposing(false)}
              className="rounded-xl border border-white/15 px-5 py-2.5 text-sm text-gray-400 transition hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {history}
    </section>
  )
}
