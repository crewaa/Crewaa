"use client"

import { useState } from "react"
import { Check, Loader2 } from "lucide-react"

import { useSession } from "@/lib/session"
import { joinWaitlist, WAITLIST_LABEL, type WaitlistProduct } from "@/lib/waitlist"
import { errorMessage } from "@/lib/types"

/**
 * In-app waitlist form for a signed-in user. The email is prefilled from the
 * session; the endpoint is idempotent, so joining twice is harmless.
 */
export function WaitlistInline({
  product,
  defaultEmail = "",
  defaultCompany = "",
}: {
  product: WaitlistProduct
  defaultEmail?: string
  defaultCompany?: string
}) {
  const [email, setEmail] = useState(defaultEmail)
  const [company, setCompany] = useState(defaultCompany)
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [error, setError] = useState("")
  const label = WAITLIST_LABEL[product]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState("sending")
    try {
      await joinWaitlist({ product, email, company: company || undefined })
      setState("done")
    } catch (err) {
      setError(errorMessage(err, "We couldn't add you just now. Please try again in a minute."))
      setState("error")
    }
  }

  if (state === "done") {
    return (
      <p className="mt-10 inline-flex items-center gap-3 rounded-xl border border-peacock-ok/30 bg-peacock-ok/10 px-4 py-3 text-sm text-peacock-ok">
        <Check className="h-4 w-4" aria-hidden />
        You&apos;re on the list. We&apos;ll email {email} when {label} opens.
      </p>
    )
  }

  const input =
    "h-12 w-full rounded-xl border border-white/10 bg-peacock-surface px-4 text-sm text-white placeholder:text-gray-500 outline-none transition focus:border-part-ai/60"

  return (
    <form onSubmit={submit} className="mt-10 max-w-xl">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" aria-label="Work email" className={input} />
        <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Brand name (optional)" aria-label="Brand name" maxLength={160} className={input} />
        <button
          type="submit"
          disabled={state === "sending"}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-part-ai px-5 text-sm font-semibold text-indigo-950 transition hover:brightness-110 disabled:opacity-60"
        >
          {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Join the waitlist
        </button>
      </div>
      {state === "error" && <p role="alert" className="mt-3 text-sm text-peacock-danger">{error}</p>}
      <p className="mt-3 text-xs text-gray-500">We&apos;ll only use your email to tell you when {label} opens.</p>
    </form>
  )
}

/** The waitlist with the signed-in user's email filled in. */
export function SessionWaitlist({ product }: { product: WaitlistProduct }) {
  const { user } = useSession()
  return <WaitlistInline key={user?.email ?? "anon"} product={product} defaultEmail={user?.email ?? ""} />
}
