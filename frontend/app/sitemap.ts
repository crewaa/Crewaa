import type { MetadataRoute } from "next"

/** Public pages only (V3). Dashboards are behind sign-in and not listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://crewaa.in"
  const pages: [string, number][] = [
    ["", 1],
    ["/collabs", 0.9],
    ["/grow", 0.7],
    ["/ai-influencers", 0.7],
    ["/marketing-suite", 0.6],
    ["/crew", 0.6],
    ["/signup", 0.5],
    ["/contact", 0.4],
    ["/privacy", 0.2],
    ["/terms", 0.2],
  ]
  return pages.map(([path, priority]) => ({ url: `${base}${path}`, priority }))
}
