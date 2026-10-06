import type { Metadata } from "next"

import { PartPage } from "@/components/site/part-page"

export const metadata: Metadata = {
  title: "AI Marketing Suite",
  description: "Content ideas, captions, ad copy, content calendars and growth reports for brands and creators. Coming soon.",
}

/** Just "coming soon" — no sign-up or notify-me (VERSION-3-PLAN.md decision 16). */
export default function MarketingSuitePage() {
  return (
    <PartPage
      part="suite"
      title="Plan, write and measure in one place."
      lead="The AI Marketing Suite will bring content ideas, captions, ad copy, content calendars and growth reports together, for brands and creators alike. We're getting it ready."
    >
      <section className="wrap">
        <ul className="plain-list" style={{ maxWidth: 640 }}>
          <li>Captions and ad copy in your voice</li>
          <li>A content calendar that fills itself</li>
          <li>Growth reports from your real data</li>
        </ul>
      </section>
    </PartPage>
  )
}
