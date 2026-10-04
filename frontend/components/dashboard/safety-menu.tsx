"use client"

/**
 * Report, block and dispute, in the thread header (V2 Phase 3).
 *
 * Crewaa shipped messaging between strangers in August with none of these. The
 * placement matters as much as the existence: it is in the conversation, next
 * to the person's name, because that is where someone is when they decide they
 * need it — not buried in account settings.
 *
 * Report and block are deliberately separate actions rather than one combined
 * "report and block". Plenty of people want behaviour on record without ending
 * a deal they cannot afford to end, and bundling them means those people never
 * report at all.
 */

import { useEffect, useRef, useState } from "react"
import { Ban, Flag, Loader2, ShieldAlert, Undo2 } from "lucide-react"

import {
  BlockState, Dispute, REPORT_REASONS, ReportReason, blockCounterpart,
  getBlockState, listDisputes, raiseDispute, reportCounterpart,
  unblockCounterpart,
} from "@/lib/trust"
import { errorMessage } from "@/lib/types"
import { useToast } from "@/components/ui/toast"

type Panel = "none" | "report" | "dispute"

export default function SafetyMenu({
  interestId,
  counterpartName,
  onBlockChange,
}: {
  interestId: number
  counterpartName: string
  onBlockChange?: (state: BlockState) => void
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<Panel>("none")
  const [block, setBlock] = useState<BlockState>({ blocked: false, blocked_by_me: false })
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [reason, setReason] = useState<ReportReason>("harassment")
  const [detail, setDetail] = useState("")
  const [disputeDetail, setDisputeDetail] = useState("")

  useEffect(() => {
    getBlockState(interestId).then((state) => {
      setBlock(state)
      onBlockChange?.(state)
    }).catch(() => {})
    listDisputes(interestId).then(setDisputes).catch(() => {})
    // onBlockChange is intentionally excluded: it is usually an inline arrow
    // from the parent, so including it would re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interestId])

  useEffect(() => {
    if (!open && panel === "none") return
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setPanel("none")
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open, panel])

  async function submitReport(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await reportCounterpart(interestId, reason, detail)
      setPanel("none")
      setDetail("")
      // Confirms receipt and nothing else — no id, no status. Either would
      // give the reporter something to quote at the person they reported.
      toast.success("Reported. Our team will review this; they will not be told.")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function toggleBlock() {
    setBusy(true)
    try {
      const next = block.blocked_by_me
        ? await unblockCounterpart(interestId)
        : await blockCounterpart(interestId)
      setBlock(next)
      onBlockChange?.(next)
      setOpen(false)
      toast.success(
        next.blocked
          ? "Blocked. Neither of you can send new messages; the conversation stays visible."
          : "Unblocked. You can message each other again.",
      )
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function submitDispute(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const created = await raiseDispute(interestId, "deal_dispute", disputeDetail)
      setDisputes((prev) => [created, ...prev])
      setPanel("none")
      setDisputeDetail("")
      toast.success("Dispute raised. An admin will look at the deal record.")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const openDispute = disputes.find((d) => d.status === "open")

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => { setOpen((v) => !v); setPanel("none") }}
        aria-label="Safety options"
        aria-expanded={open}
        className="rounded-lg border border-white/10 p-2 text-gray-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <ShieldAlert className="h-4 w-4" />
      </button>

      {open && panel === "none" && (
        <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-white/10 bg-[#0B0D17] shadow-xl">
          <button
            onClick={() => setPanel("report")}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-gray-300 transition hover:bg-white/5"
          >
            <Flag className="h-4 w-4" /> Report {counterpartName}
          </button>

          <button
            onClick={toggleBlock}
            disabled={busy || (block.blocked && !block.blocked_by_me)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-gray-300 transition hover:bg-white/5 disabled:opacity-40"
          >
            {block.blocked_by_me ? (
              <><Undo2 className="h-4 w-4" /> Unblock</>
            ) : (
              <><Ban className="h-4 w-4" /> Block</>
            )}
          </button>

          {/* Shown only when the other side blocked you: offering an Unblock
              button you cannot use would read as the app being broken. */}
          {block.blocked && !block.blocked_by_me && (
            <p className="border-t border-white/5 px-4 py-3 text-xs text-gray-500">
              {counterpartName} has blocked messaging on this deal. Only they
              can lift it.
            </p>
          )}

          <button
            onClick={() => setPanel("dispute")}
            disabled={!!openDispute}
            className="flex w-full items-center gap-2 border-t border-white/5 px-4 py-3 text-left text-sm text-gray-300 transition hover:bg-white/5 disabled:opacity-40"
          >
            <ShieldAlert className="h-4 w-4" />
            {openDispute ? "Dispute already open" : "Dispute this deal"}
          </button>
        </div>
      )}

      {panel === "report" && (
        <form
          onSubmit={submitReport}
          className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-white/10 bg-[#0B0D17] p-4 shadow-xl"
        >
          <h3 className="text-sm font-medium text-white">Report {counterpartName}</h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            They are not told you reported them, now or later.
          </p>

          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as ReportReason)}
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
          >
            {REPORT_REASONS.map((r) => (
              <option key={r.value} value={r.value} className="bg-[#0B0D17]">
                {r.label}
              </option>
            ))}
          </select>

          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            placeholder={
              reason === "other"
                ? "Tell us what happened (required)"
                : "Anything else that would help (optional)"
            }
            className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
          />

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPanel("none")}
              className="rounded-lg px-3 py-2 text-sm text-gray-400 transition hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || (reason === "other" && !detail.trim())}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Send report
            </button>
          </div>
        </form>
      )}

      {panel === "dispute" && (
        <form
          onSubmit={submitDispute}
          className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-white/10 bg-[#0B0D17] p-4 shadow-xl"
        >
          <h3 className="text-sm font-medium text-white">Dispute this deal</h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Flags the deal for an admin to review. It does not change the agreed
            terms or the delivery record — those stay exactly as they are,
            because they are what an admin will read.
          </p>

          <textarea
            value={disputeDetail}
            onChange={(e) => setDisputeDetail(e.target.value)}
            rows={4}
            placeholder="What went wrong? Be specific — dates, what was agreed, what happened."
            className="mt-3 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
          />

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPanel("none")}
              className="rounded-lg px-3 py-2 text-sm text-gray-400 transition hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || disputeDetail.trim().length < 10}
              className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-500 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Raise dispute
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/** The banner shown on a disputed deal, for both parties. */
export function DisputeBanner({ disputes }: { disputes: Dispute[] }) {
  const open = disputes.find((d) => d.status === "open")
  if (!open) return null

  return (
    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
      <h3 className="flex items-center gap-2 text-sm font-medium text-amber-200">
        <ShieldAlert className="h-4 w-4" />
        {open.raised_by_me ? "You disputed this deal" : "This deal is disputed"}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-300">{open.detail}</p>
      <p className="mt-2 text-xs text-gray-500">
        An admin is reviewing. The agreed terms and delivery record are
        unchanged.
      </p>
    </div>
  )
}
