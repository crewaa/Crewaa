import { ComingSoon } from "@/components/dashboard/coming-soon"
import { SessionWaitlist } from "@/components/dashboard/waitlist-inline"

export const metadata = { title: "AI Influencers" }

export default function AiInfluencersPage() {
  return (
    <ComingSoon
      part="ai"
      title="An influencer made for your brand."
      description="Create an AI influencer with your brand's look and voice, and produce content whenever you need it. Every post will be clearly labelled as AI-generated. Join the waitlist and we'll email you when it opens."
      points={["A consistent face and voice for your brand", "Reels and posts on your schedule", "Clear AI labelling on everything"]}
    >
      <SessionWaitlist product="ai_influencers" />
    </ComingSoon>
  )
}
