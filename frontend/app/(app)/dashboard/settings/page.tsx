"use client"

/**
 * Settings → Email notifications (V3 Phase 4).
 *
 * Each switch saves on its own, straight away: there is no form to forget to
 * submit. The in-app bell is unaffected — these only decide what is emailed.
 */

import { useEffect, useState } from "react"
import { Handshake, Loader2, Mail, MessageCircle, Wrench } from "lucide-react"

import { getEmailPreferences, updateEmailPreferences, type EmailCategory, type EmailPreferences } from "@/lib/email"
import { useSession } from "@/lib/session"
import { errorMessage } from "@/lib/types"
import { useToast } from "@/components/ui/toast"

/** Crewaa Crew is "coming soon" (decision 18); its switch returns when Crew launches. */
const CREW_LAUNCHED = false

const ROWS: { key: EmailCategory; title: string; description: string; icon: typeof Mail; creatorsOnly?: boolean }[] = [
  {
    key: "messages",
    title: "New messages",
    description: "When someone messages you. At most one email per conversation every 30 minutes.",
    icon: MessageCircle,
  },
  {
    key: "deals",
    title: "Collaboration updates",
    description: "Interest in campaigns, offers and counter-offers, deliveries and reviews on your collaborations.",
    icon: Handshake,
  },
  {
    key: "crew",
    title: "Crewaa Crew updates",
    description: "Progress on the editing, writing and design work you request.",
    icon: Wrench,
    creatorsOnly: true,
  },
]

function Switch({ on, busy, onChange, label }: { on: boolean; busy: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition disabled:opacity-60 ${
        on ? "border-peacock-teal/60 bg-peacock-teal" : "border-white/15 bg-white/[0.06]"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full shadow transition-transform ${
          on ? "translate-x-6 bg-peacock-on-teal" : "translate-x-1 bg-gray-400"
        }`}
      />
    </button>
  )
}

export default function SettingsPage() {
  const { user } = useSession()
  const toast = useToast()
  const [prefs, setPrefs] = useState<EmailPreferences | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<EmailCategory | null>(null)

  useEffect(() => {
    getEmailPreferences().then(setPrefs).catch((err) => setError(errorMessage(err)))
  }, [])

  async function toggle(key: EmailCategory, value: boolean) {
    if (!prefs) return
    setBusy(key)
    setPrefs({ ...prefs, [key]: value }) // optimistic
    try {
      setPrefs(await updateEmailPreferences({ [key]: value }))
    } catch (err) {
      setPrefs(prefs)
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const rows = ROWS.filter((r) => (r.key !== "crew" || CREW_LAUNCHED) && (!r.creatorsOnly || user?.role === "INFLUENCER"))

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-sm font-medium text-peacock-teal">Settings</p>
      <h1 className="mt-1 font-display text-4xl font-medium text-white">Email notifications</h1>
      <p className="mt-3 max-w-xl text-gray-400">
        Choose what we email you about. Everything still appears under the bell in Crewaa.
        {user?.email && <> Emails go to <span className="text-white">{user.email}</span>.</>}
      </p>

      {prefs && !prefs.email_enabled && (
        <p className="mt-6 rounded-xl border border-peacock-gold/30 bg-peacock-gold/10 px-4 py-3 text-sm text-peacock-gold">
          Email isn&apos;t switched on for Crewaa yet. Your choices are saved and will apply as soon as it is.
        </p>
      )}

      <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-peacock-surface">
        {error ? (
          <p className="p-6 text-sm text-peacock-danger">{error}</p>
        ) : !prefs ? (
          <div className="flex items-center gap-3 p-6 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {rows.map(({ key, title, description, icon: Icon }) => (
              <li key={key} className="flex items-start gap-4 p-5 sm:p-6">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-peacock-teal">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-400">{description}</p>
                </div>
                <Switch on={prefs[key]} busy={busy === key} onChange={(v) => toggle(key, v)} label={title} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-500">
        Every email also has a one-click unsubscribe link at the bottom.
      </p>
    </div>
  )
}
