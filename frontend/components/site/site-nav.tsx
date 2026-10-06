"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Menu, X } from "lucide-react"

import { SITE_PARTS } from "./parts-data"

export function SiteNav() {
  const pathname = usePathname()
  const [solid, setSolid] = useState(false)
  // The menu remembers the page it was opened on, so navigating closes it
  // without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <nav className={`nav ${solid ? "solid" : ""} ${open ? "open" : ""}`} aria-label="Main">
      <div className="wrap">
        <Link href="/" className="logo" aria-label="Crewaa home">
          <Image src="/crewaa-logo-dark.svg" alt="Crewaa" width={115} height={34} priority unoptimized />
        </Link>
        <div className="links">
          {SITE_PARTS.map((p) => (
            <Link key={p.id} href={p.href} aria-current={pathname === p.href ? "page" : undefined}>
              <i style={{ background: p.color }} />
              {p.short}
            </Link>
          ))}
        </div>
        <div className="cta">
          <Link className="login" href="/login">Log in</Link>
          <Link className="btn p sm" href="/signup">Get started</Link>
          <button
            className="burger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpenOn(open ? null : pathname)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      <div className="menu">
        {SITE_PARTS.map((p) => (
          <Link key={p.id} href={p.href}>
            <i style={{ background: p.color }} />
            {p.name}
            {p.soon && <span className="soon ghost">Soon</span>}
          </Link>
        ))}
        <Link href="/login">Log in</Link>
      </div>
    </nav>
  )
}
