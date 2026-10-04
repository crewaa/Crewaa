"use client"

/**
 * Account verification (V2 Phase 3, decision #4 — manual review).
 *
 * Today anyone can type any Instagram handle into their profile and be matched
 * on someone else's audience. This does not fix that by itself; it gives an
 * admin a queue and the other party a signal.
 *
 * Deliberately a signal and not a gate. Nothing in discovery or messaging is
 * restricted to verified accounts — gating on it would silently delist every
 * existing creator the moment it shipped, which is a worse failure than the
 * one it set out to fix.
 */

import { useEffect, useState } from "react"
import { BadgeCheck, Clock, Loader2, ShieldQuestion, XCircle } from "lucide-react"

import {
  VerificationState, getVerification, requestVerification,
} from "@/lib/trust"
import { errorMessage } from "@/lib/types"
import { useToast } from "@/components/ui/toast"

export default function VerificationCard() {
  const toast = useToast()
  const [state, setState] = useState<VerificationState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getVerification().then(setState).catch(() => {})
  }, [])

  async function submit() {
    setBusy(true)
    try {
      setState(await requestVerification())
      toast.success("Request sent. An admin will review your account.")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!state) return null

  const presentation = {
    verified: {
      Icon: BadgeCheck,
      tone: "border-emerald-500/30 bg-emerald-500/[0.07]",
      accent: "text-emerald-300",
      title: "Verified",
      body: "Brands and creators you work with can see that Crewaa has checked this account.",
    },
    pending: {
      Icon: Clock,
      tone: "border-indigo-500/30 bg-indigo-500/[0.07]",
      accent: "text-indigo-300",
      title: "Verification in review",
      body: "An admin is checking your account. Nothing is blocked while you wait.",
    },
    rejected: {
      Icon: XCircle,
      tone: "border-red-500/30 bg-red-500/[0.07]",
      accent: "text-red-300",
      title: "Verification not approved",
      body: state.note ?? "Have another look at your profile and try again.",
    },
    unverified: {
      Icon: ShieldQuestion,
      tone: "border-white/10 bg-white/[0.03]",
      accent: "text-gray-300",
      title: "Not verified",
      body: "Verification tells the people you work with that Crewaa has checked this account is really yours. It is optional — nothing is restricted without it.",
    },
  }[state.status]

  const { Icon } = presentation
  const canRequest = state.status === "unverified" || state.status === "rejected"

  return (
    <section className={`rounded-2xl border p-5 ${presentation.tone}`}>
      <h2 className={`flex items-center gap-2 text-sm font-medium ${presentation.accent}`}>
        <Icon className="h-4 w-4" />
        {presentation.title}
      </h2>

      <p className="mt-2 text-sm leading-relaxed text-gray-300">
        {presentation.body}
      </p>

      {canRequest && (
        <button
          onClick={submit}
          disabled={busy}
          className="mt-4 flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {state.status === "rejected" ? "Request again" : "Request verification"}
        </button>
      )}
    </section>
  )
}
