import type { Metadata } from "next"

import { Hero } from "@/components/site/home/hero"
import { Parts } from "@/components/site/home/parts"
import { FinalCta, GrowBand, Marquee, Sides, Timeline, Trust } from "@/components/site/home/sections"

export const metadata: Metadata = {
  title: { absolute: "Crewaa — brands, businesses and creators. One crew." },
  description:
    "Find verified creators with an Authenticity Score, run brand collaborations end to end, and soon grow your business online, launch AI influencers and hire editors and writers. Built for India.",
}

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Marquee />
      <Parts />
      <Trust />
      <Sides />
      <Timeline />
      <GrowBand />
      <FinalCta />
    </main>
  )
}
