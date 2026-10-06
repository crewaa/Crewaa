import type { Metadata } from "next"

import { FeatureGrid, PartPage } from "@/components/site/part-page"
import { WaitlistForm } from "@/components/site/waitlist-form"

export const metadata: Metadata = {
  title: "AI Influencers",
  description: "Create an AI influencer with your brand's look and voice. Every post clearly labelled as AI-generated. Join the waitlist.",
}

export default function AiInfluencersPage() {
  return (
    <PartPage
      part="ai"
      title="An influencer made for your brand."
      lead="Create an AI influencer with your brand's look and voice, and produce content whenever you need it. Every post will be clearly labelled as AI-generated. Join the waitlist to be first in."
      hero={<WaitlistForm />}
    >
      <FeatureGrid items={[
        ["A consistent face", "One recognisable look, post after post, built around your brand."],
        ["Your brand's voice", "Captions and scripts that sound like you, not a template."],
        ["Content on your schedule", "Reels and posts when you need them, without booking a shoot."],
        ["Clearly labelled", "Every piece of content is marked as AI-generated. No pretending."],
        ["You approve everything", "Nothing goes out until you've signed it off."],
        ["Alongside real creators", "Use it next to your Collabs campaigns, not instead of them."],
      ]} />
    </PartPage>
  )
}
