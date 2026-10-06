import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/unsubscribe", "/set-password"] },
    sitemap: "https://crewaa.in/sitemap.xml",
  }
}
