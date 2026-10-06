"use client"

import { useState } from "react"

import { api } from "@/lib/axios"
import { errorMessage } from "@/lib/types"

/** AI Influencers waitlist (VERSION-3-PLAN.md decision 12). */
export function WaitlistForm({ product = "ai_influencers", defaultEmail = "" }: { product?: string; defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail)
  const [company, setCompany] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [error, setError] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState("sending")
    try {
      await api.post("/waitlist", { product, email, company: company || undefined })
      setState("done")
    } catch (err) {
      setError(errorMessage(err, "We couldn't add you just now. Please try again in a minute."))
      setState("error")
    }
  }

  if (state === "done") {
    return (
      <div className="waitlist">
        <p className="msg ok">You&apos;re on the list. We&apos;ll email {email} when AI Influencers opens.</p>
      </div>
    )
  }

  return (
    <form className="waitlist" onSubmit={submit}>
      <div className="row">
        <input id="wl-email" type="email" required placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Work email" />
        <input id="wl-company" type="text" placeholder="Brand name (optional)" value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Brand name" maxLength={160} />
      </div>
      <div className="row">
        <button className="btn p" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      {state === "error" && <p className="msg err" role="alert">{error}</p>}
      <small>We&apos;ll only use your email to tell you when AI Influencers opens.</small>
    </form>
  )
}
