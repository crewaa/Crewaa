import type { Metadata } from "next"

import { PartPage } from "@/components/site/part-page"

export const metadata: Metadata = {
  title: "Crewaa Grow",
  description: "Crewaa Grow: our team runs your ads, finds you leads and builds your presence online. Coming soon.",
}

/** Just "coming soon" — no sign-up or notify-me (VERSION-3-PLAN.md decision 16). */
export default function GrowPage() {
  return (
    <PartPage
      part="grow"
      title="Run your business. We'll grow it online."
      lead="Crewaa Grow will be a service: our team runs your ads, finds you leads and builds your presence online, and you follow every step from your dashboard. We're getting it ready."
    >
      <section className="wrap">
        <div className="svcs" style={{ fontFamily: "var(--display)" }}>
          {["Meta ads", "Lead generation", "Google Business Profile", "Websites", "SEO", "Social media management", "Creator campaigns", "Monthly growth reports"].map((s) => <span key={s}>{s}</span>)}
        </div>
      </section>
    </PartPage>
  )
}
