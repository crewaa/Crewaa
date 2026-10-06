"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"

import { CrewaaMark } from "../crewaa-mark"

/** Creators and brands orbiting the mark. Illustrative, not real accounts. */
const CHIPS = [
  { o: 0, a: 0, av: "AK", bg: "var(--c-collabs)", name: "Ananya", tag: "Food" },
  { o: 0, a: 3.14, av: "RV", bg: "var(--gold)", name: "Rohan", tag: "Tech" },
  { o: 1, a: 1.2, av: "S", bg: "var(--c-suite)", name: "Skincare brand", brand: true },
  { o: 1, a: 4.3, av: "MI", bg: "var(--c-crew)", name: "Meher", tag: "Fashion" },
  { o: 2, a: 2.4, av: "D", bg: "var(--c-ai)", name: "D2C snacks", brand: true },
  { o: 2, a: 5.6, av: "KP", bg: "var(--blue)", name: "Kabir", tag: "Fitness", ok: "92 authenticity" },
]
/** Ellipses as fractions of the stage width, matching the drawn orbit lines. */
const ORBITS = [
  { rx: 0.475, ry: 0.197, rot: -18, sp: 0.00011 },
  { rx: 0.4, ry: 0.333, rot: 24, sp: -0.00008 },
  { rx: 0.487, ry: 0.117, rot: 32, sp: 0.00006 },
]

export function Hero() {
  const heroRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const spotRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<SVGCircleElement>(null)
  const chipRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const stage = stageRef.current
    if (!stage) return
    let raf = 0

    // 1. The gold dot travels round the arc as it draws, then lands — the logo assembling itself.
    const dot = dotRef.current
    const C = 256, R = 150
    const place = (a: number) => {
      dot?.setAttribute("cx", String(C + R * Math.cos(a)))
      dot?.setAttribute("cy", String(C + R * Math.sin(a)))
    }
    if (dot && !reduce) {
      const startA = (-40 * Math.PI) / 180, endA = -2 * Math.PI
      const t0 = performance.now() + 150, dur = 2200
      const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
      dot.style.opacity = "0"
      const step = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - t0) / dur))
        dot.style.opacity = String(Math.min(1, t * 4))
        place(startA + (endA - startA) * ease(t))
        if (t < 1) requestAnimationFrame(step)
        else place(0)
      }
      requestAnimationFrame(step)
    }

    // 2. Chips orbit the mark, passing in front of and behind it.
    const state = CHIPS.map((c, i) => ({ ...c, el: chipRefs.current[i], w: 0, h: 0 }))
    let W = stage.clientWidth
    const measure = () => {
      W = stage.clientWidth
      state.forEach((s) => { if (s.el) { s.w = s.el.offsetWidth; s.h = s.el.offsetHeight } })
    }
    measure()
    window.addEventListener("resize", measure)
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      for (const s of state) {
        if (!s.el) continue
        const o = ORBITS[s.o]
        s.a += reduce ? 0 : o.sp * dt
        const x0 = Math.cos(s.a) * o.rx * W, y0 = Math.sin(s.a) * o.ry * W, r = (o.rot * Math.PI) / 180
        const x = x0 * Math.cos(r) - y0 * Math.sin(r) + W / 2
        const y = x0 * Math.sin(r) + y0 * Math.cos(r) + W / 2
        const depth = Math.sin(s.a)
        s.el.style.transform = `translate(${x - s.w / 2}px, ${y - s.h / 2}px) scale(${0.82 + (0.2 * (depth + 1)) / 2})`
        s.el.style.zIndex = depth > 0 ? "3" : "1"
        s.el.style.opacity = (0.45 + (0.55 * (depth + 1)) / 2).toFixed(2)
      }
      if (!reduce) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // 3. Gentle tilt and a soft gold light that follow the pointer (desktop only).
    const hero = heroRef.current
    const fine = window.matchMedia("(pointer: fine)").matches
    const onMove = (e: PointerEvent) => {
      if (!hero) return
      const r = hero.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5
      if (innerRef.current) innerRef.current.style.transform = `rotateY(${px * 10}deg) rotateX(${-py * 8}deg)`
      spotRef.current?.style.setProperty("--mx", `${e.clientX - r.left}px`)
      spotRef.current?.style.setProperty("--my", `${e.clientY - r.top}px`)
    }
    const onLeave = () => { if (innerRef.current) innerRef.current.style.transform = "" }
    if (hero && fine && !reduce) {
      hero.addEventListener("pointermove", onMove)
      hero.addEventListener("pointerleave", onLeave)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", measure)
      hero?.removeEventListener("pointermove", onMove)
      hero?.removeEventListener("pointerleave", onLeave)
    }
  }, [])

  return (
    <header className="hero" ref={heroRef}>
      <div className="spot" ref={spotRef} aria-hidden="true" />
      <div className="wrap">
        <div>
          <div className="intro"><span className="pip" />Coming soon: Crewaa Grow, AI Influencers and Crewaa Crew</div>
          <h1 className="h1">
            <span className="ln"><span>Brands, businesses</span></span>
            <span className="ln"><span>and creators.</span></span>
            <span className="ln"><span>One crew<span className="gdot" aria-hidden="true" /></span></span>
          </h1>
          <p className="lede">
            Find verified creators, grow your business online, launch AI influencers, and give creators the
            editors and writers they need. All in one place, built for India.
          </p>
          <div className="cta-row">
            <Link className="btn p" href="/signup">Get started free</Link>
            <Link className="btn line" href="#parts">See what&apos;s inside</Link>
          </div>
          <div className="who-row">
            <Link href="/signup/brand"><i style={{ background: "var(--c-collabs)" }} />I&apos;m a brand</Link>
            <Link href="/grow"><i style={{ background: "var(--c-grow)" }} />I run a business</Link>
            <Link href="/signup/influencer"><i style={{ background: "var(--c-crew)" }} />I&apos;m a creator</Link>
          </div>
        </div>

        <div className="stage" ref={stageRef} aria-hidden="true">
          <div className="stage-inner" ref={innerRef}>
            <svg className="orbits" viewBox="0 0 600 600" preserveAspectRatio="none">
              <ellipse cx="300" cy="300" rx="285" ry="118" transform="rotate(-18 300 300)" />
              <ellipse className="d" cx="300" cy="300" rx="240" ry="200" transform="rotate(24 300 300)" />
              <ellipse cx="300" cy="300" rx="292" ry="70" transform="rotate(32 300 300)" />
            </svg>
            <CrewaaMark className="mark" animated ref={dotRef} />
            {CHIPS.map((c, i) => (
              <div key={c.name} className={`chip ${c.brand ? "brand" : ""}`} ref={(el) => { chipRefs.current[i] = el }}>
                <span className="av" style={{ background: c.bg }}>{c.av}</span>
                {c.name}
                {c.tag && <small>{c.tag}</small>}
                {c.ok && <span className="ok">{c.ok}</span>}
              </div>
            ))}
          </div>
          <div className="deal"><span>Deal agreed</span><b>3 reels for a skincare launch</b></div>
        </div>
      </div>
    </header>
  )
}
