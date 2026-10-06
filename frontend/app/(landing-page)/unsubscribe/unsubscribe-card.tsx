"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

import { unsubscribe } from "@/lib/email"
import { errorMessage } from "@/lib/types"

const LABELS: Record<string, string> = {
  messages: "new message emails",
  deals: "collaboration update emails",
  crew: "Crewaa Crew update emails",
  all: "all Crewaa emails",
}

/**
 * The page behind "Unsubscribe" in an email footer. It asks for one click
 * rather than unsubscribing on load: email security scanners open links, and
 * opening a link must not change anyone's settings.
 */
export function UnsubscribeCard() {
  const token = useSearchParams().get("token") ?? ""
  const category = token.split(".")[1] ?? ""
  const label = LABELS[category]
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [error, setError] = useState("")

  async function confirm() {
    setState("sending")
    try {
      await unsubscribe(token)
      setState("done")
    } catch (err) {
      setError(errorMessage(err, "Something went wrong. Please try again."))
      setState("error")
    }
  }

  if (!token || !label) {
    return (
      <>
        <h1>This link isn&apos;t complete.</h1>
        <p className="lead">Sign in and open Settings to choose which emails you get.</p>
        <div className="cta-row" style={{ marginTop: 32 }}>
          <Link className="btn p" href="/dashboard/settings">Open settings</Link>
        </div>
      </>
    )
  }

  if (state === "done") {
    return (
      <>
        <h1>You&apos;re unsubscribed.</h1>
        <p className="lead">We won&apos;t send you {label} any more. Everything still shows under the bell when you sign in, and you can switch emails back on in Settings.</p>
        <div className="cta-row" style={{ marginTop: 32 }}>
          <Link className="btn line" href="/dashboard/settings">Email settings</Link>
        </div>
      </>
    )
  }

  return (
    <>
      <h1>Stop {label}?</h1>
      <p className="lead">You&apos;ll still see everything under the bell in Crewaa.</p>
      <div className="cta-row" style={{ marginTop: 32 }}>
        <button className="btn p" onClick={confirm} disabled={state === "sending"}>
          {state === "sending" ? "Unsubscribing…" : "Unsubscribe"}
        </button>
        <Link className="btn line" href="/dashboard/settings">Choose in settings</Link>
      </div>
      {state === "error" && <p className="lead" role="alert" style={{ color: "var(--danger, #F2716B)", marginTop: 20, fontSize: 15 }}>{error}</p>}
    </>
  )
}
