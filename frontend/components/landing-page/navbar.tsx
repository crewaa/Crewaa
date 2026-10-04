import Link from "next/link"
import { Button } from "@/components/ui/button"
import Image from "next/image"

export function LandingPageNavbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <nav className="relative mx-auto flex h-16 max-w-7xl items-center justify-between overflow-hidden rounded-2xl border border-white/8 bg-[#0f141a]/72 px-5 backdrop-blur-xl sm:px-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-8 top-0 h-20 w-28 rounded-full bg-cyan-400/8 blur-2xl" />
          <div className="absolute right-0 top-0 h-24 w-32 rounded-full bg-indigo-500/8 blur-2xl" />
          <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        </div>

        <Link href="/" className="relative z-10 flex items-center" aria-label="Crewaa home">
          {/* The full lockup, so the navbar matches the brand sheet exactly —
              the mark and wordmark are one asset rather than an icon beside
              hand-set text that can drift out of sync with it.

              `unoptimized` because this is an SVG: Next's image optimizer
              refuses SVGs unless `dangerouslyAllowSVG` is enabled globally,
              and a vector gains nothing from raster optimization anyway. */}
          <Image
            src="/crewaa-logo-dark.svg"
            alt="Crewaa"
            width={108}
            height={32}
            priority
            unoptimized
            className="h-8 w-auto"
          />
        </Link>

        <div className="relative z-10 flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-slate-300 transition hover:text-white"
          >
            Login
          </Link>

          <Link href="/signup">
            <Button className="border border-cyan-200/10 bg-white/[0.06] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:bg-cyan-300/12 hover:text-white">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>
    </header>
  )
}
