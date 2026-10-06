import Image from "next/image"
import Link from "next/link"

import { SITE_PARTS } from "./parts-data"

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div>
          <Link href="/" aria-label="Crewaa home">
            <Image src="/crewaa-logo-dark.svg" alt="Crewaa" width={101} height={30} unoptimized />
          </Link>
          <p>The creator economy platform for brands, businesses and creators in India.</p>
        </div>
        <nav aria-label="Platform">
          <h4>Platform</h4>
          {SITE_PARTS.map((p) => (
            <Link key={p.id} href={p.href}>{p.name}</Link>
          ))}
        </nav>
        <nav aria-label="Company">
          <h4>Company</h4>
          <Link href="/contact">Contact</Link>
          <Link href="/signup">Get started</Link>
          <Link href="/login">Log in</Link>
        </nav>
        <nav aria-label="Legal">
          <h4>Legal</h4>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </div>
    </footer>
  )
}
