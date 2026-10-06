import type { Metadata } from "next"

import { PartPage } from "@/components/site/part-page"

export const metadata: Metadata = {
  title: "Crewaa Crew",
  description: "Crewaa Crew: video editors, script writers and designers for creators. Coming soon.",
}

/**
 * Just "coming soon", like Grow and the Marketing Suite — no sign-up or
 * notify-me (VERSION-3-PLAN.md decision 18). The full service is a later phase.
 */
export default function CrewPage() {
  return (
    <PartPage
      part="crew"
      title="Hire your crew. Keep creating."
      lead="Crewaa Crew will give creators video editors, script writers, thumbnail designers and more, from our in-house team and vetted freelancers. We're getting it ready."
    >
      <section className="wrap">
        <div className="svcs" style={{ fontFamily: "var(--display)" }}>
          {["Video editing", "Script writing", "Thumbnails", "Post design", "In-house team", "Vetted freelancers"].map((s) => <span key={s}>{s}</span>)}
        </div>
      </section>
    </PartPage>
  )
}
