import "@/components/site/site.css"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteNav } from "@/components/site/site-nav"

/**
 * Public site shell (V3): home, the part pages, contact and legal pages share
 * one navigation and footer. Everything is scoped under `.site`.
 */
export default function LandingPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <div className="grain" aria-hidden="true" />
      <SiteNav />
      {children}
      <SiteFooter />
    </div>
  )
}
