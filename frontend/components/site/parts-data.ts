/** The five parts as the public site presents them (V3). */
export type SitePart = {
  id: "collabs" | "grow" | "ai" | "suite" | "crew"
  name: string
  short: string
  href: string
  color: string
  forWho: string
  soon: boolean
}

export const SITE_PARTS: SitePart[] = [
  { id: "collabs", name: "Collabs", short: "Collabs", href: "/collabs", color: "#26BDB0", forWho: "for brands and creators", soon: false },
  { id: "grow", name: "Crewaa Grow", short: "Grow", href: "/grow", color: "#D8B45A", forWho: "for businesses", soon: true },
  { id: "ai", name: "AI Influencers", short: "AI Influencers", href: "/ai-influencers", color: "#8FA8FF", forWho: "for brands", soon: true },
  { id: "suite", name: "AI Marketing Suite", short: "Marketing Suite", href: "/marketing-suite", color: "#EE8A6B", forWho: "for brands and creators", soon: true },
  { id: "crew", name: "Crewaa Crew", short: "Crew", href: "/crew", color: "#B49CF0", forWho: "for creators", soon: true },
]

export const partById = (id: SitePart["id"]) => SITE_PARTS.find((p) => p.id === id)!
