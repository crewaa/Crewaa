import type { Metadata } from "next"
import Link from "next/link"

import { FeatureGrid, PartPage, Steps } from "@/components/site/part-page"

export const metadata: Metadata = {
  title: "Collabs",
  description: "Brand and creator collaborations on Crewaa: AI-ranked shortlists, an Authenticity Score on every creator, agreed terms, proof of posting and two-way reviews.",
}

export default function CollabsPage() {
  return (
    <PartPage
      part="collabs"
      title="Brand and creator collaborations, start to finish."
      lead="Post a campaign, get an AI-ranked shortlist of real creators, and run the whole deal on Crewaa: messages, terms, delivery and reviews."
      hero={
        <div className="cta-row">
          <Link className="btn p" href="/signup/brand">Join as a brand</Link>
          <Link className="btn line" href="/signup/influencer">Join as a creator</Link>
        </div>
      }
    >
      <FeatureGrid items={[
        ["AI-ranked shortlists", "Describe your campaign and get creators ranked on their real Instagram and YouTube numbers, with the reasons for each match."],
        ["Authenticity Score", "Every creator is checked for patterns common with fake followers, bought likes and bot comments, with the evidence shown."],
        ["Private brand briefs", "Creators see the opportunity first. The brand is revealed only when both sides say yes."],
        ["Messages and offers", "Chat, send offers and counter-offers, and lock in terms both sides can see."],
        ["Proof on record", "Creators submit proof of posting, saved with a timestamp nobody can edit."],
        ["Honest reviews", "Both sides review each other, hidden until both have submitted."],
      ]} />
      <Steps title="How a collaboration runs." items={[
        ["Post a campaign", "Your product, audience, budget, deliverables and deadline, in your own words."],
        ["Get your shortlist", "AI ranks creators on real data, with an Authenticity Score next to each one."],
        ["Agree the terms", "Message the creators you like, make an offer, and lock in the deal."],
        ["Track and review", "The creator submits proof of posting, and you both leave a review."],
      ]} />
    </PartPage>
  )
}
