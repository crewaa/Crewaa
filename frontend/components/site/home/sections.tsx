"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { CrewaaMark } from "../crewaa-mark"

const CATEGORIES = ["Food", "Fashion", "Beauty", "Tech", "Travel", "Fitness", "Finance", "Gaming", "Parenting", "Comedy", "Education", "Music"]

export function Marquee() {
  const items = [...CATEGORIES, ...CATEGORIES]
  return (
    <div className="marquee" aria-label="Creator categories">
      <div className="track">
        {items.map((c, i) => (
          <span key={i} style={{ display: "contents" }}><span>{c}</span><i /></span>
        ))}
      </div>
    </div>
  )
}

const Check = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
const Note = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6M12 17h.01" /></svg>

export function Trust() {
  const ref = useRef<HTMLDivElement>(null)
  const [run, setRun] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setRun(true); io.disconnect() } }, { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section className="block" id="trust">
      <div className="wrap scanwrap">
        <div>
          <h2 className="h2">Spot fake followers before you pay for them.</h2>
          <p className="lead">Every creator on Crewaa gets an Authenticity Score. We look for fake followers, bought likes and bot comments, and show you exactly what we found.</p>
          <div className="promises">
            <div><b>Private brand briefs</b><span>Creators see the opportunity first. The brand is revealed when both sides say yes.</span></div>
            <div><b>Proof on record</b><span>Agreed terms and proof of posting are saved and can&apos;t be edited later.</span></div>
            <div><b>Honest reviews</b><span>Reviews stay hidden until both sides submit, so nobody reviews in revenge.</span></div>
          </div>
        </div>
        <div className={`scan ${run ? "run" : ""}`} ref={ref} aria-label="Example Authenticity Score">
          <div className="beam" aria-hidden="true" />
          <div className="top">
            <span className="av">AK</span>
            <div><b>Ananya Kulkarni</b><small>Example creator, 84.3K followers</small></div>
            <div className="ring">
              <svg viewBox="0 0 36 36" aria-hidden="true">
                <defs><linearGradient id="lp-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#26BDB0" /><stop offset="1" stopColor="#D8B45A" /></linearGradient></defs>
                <circle className="bgc" cx="18" cy="18" r="15.9" />
                <circle className="fg" cx="18" cy="18" r="15.9" pathLength={100} stroke="url(#lp-ring)" />
              </svg>
              <span>92</span>
            </div>
          </div>
          <ul className="signals">
            <li className="y"><Check />Engagement is normal for her size<em>4.1%</em></li>
            <li className="y"><Check />No sudden follower jumps<em>90 days</em></li>
            <li className="y"><Check />Comments read like real conversation<em>8% generic</em></li>
            <li className="y"><Check />A healthy share of followers watch new reels<em>25%</em></li>
            <li className="w"><Note />Two pinned posts left out of averages<em>older posts</em></li>
          </ul>
        </div>
      </div>
    </section>
  )
}

const SETS = {
  brand: [
    ["var(--c-collabs)", "Collabs", "Find, hire and track creators"],
    ["var(--c-grow)", "Crewaa Grow", "Ads, leads and online presence · soon"],
    ["var(--c-ai)", "AI Influencers", "Your own AI ambassador · soon"],
    ["var(--c-suite)", "AI Marketing Suite", "Plan, write and report · soon"],
  ],
  creator: [
    ["var(--c-collabs)", "Collabs", "Brand deals that fit you"],
    ["var(--c-suite)", "AI Marketing Suite", "Growth reports and content help · soon"],
    ["var(--c-crew)", "Crewaa Crew", "Editors, writers and designers · soon"],
  ],
} as const

export function Sides() {
  const [side, setSide] = useState<"brand" | "creator">("brand")
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [knob, setKnob] = useState({ x: 5, w: 0 })
  useEffect(() => {
    const place = () => {
      const el = tabs.current[side]
      if (el) setKnob({ x: el.offsetLeft, w: el.offsetWidth })
    }
    place()
    window.addEventListener("resize", place)
    return () => window.removeEventListener("resize", place)
  }, [side])

  return (
    <section className="block" id="who">
      <div className="wrap sides">
        <div>
          <h2 className="h2">One account. Your version of Crewaa.</h2>
          <p className="lead" style={{ maxWidth: "40ch", marginBottom: 8 }}>Brands and creators see different parts, so everything on your screen is something you can use.</p>
          <div className="switch" role="tablist" aria-label="Choose your side">
            <span className="knob" style={{ transform: `translateX(${knob.x}px)`, width: knob.w }} />
            {(["brand", "creator"] as const).map((k) => (
              <button key={k} role="tab" aria-selected={side === k} ref={(el) => { tabs.current[k] = el }} onClick={() => setSide(k)}>
                {k === "brand" ? "Brands and businesses" : "Creators"}
              </button>
            ))}
          </div>
        </div>
        <ul className="plist" key={side}>
          {SETS[side].map(([c, n, d], i) => (
            <li key={n} style={{ animationDelay: `${i * 0.06}s` }}><i style={{ background: c }} /><b>{n}</b><span>{d}</span></li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const STEPS = [
  ["Post a campaign", "Describe your product, audience, budget and platforms."],
  ["Get your shortlist", "AI ranks creators on real data, with an Authenticity Score for each."],
  ["Agree the terms", "Message, send offers and counter-offers, then lock in the deal."],
  ["Track and review", "Creators submit proof of posting, and both sides leave a review."],
]

export function Timeline() {
  const ref = useRef<HTMLDivElement>(null)
  const [p, setP] = useState(1)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const onScroll = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect(), vh = window.innerHeight
      setP(Math.min(1, Math.max(0, (vh * 0.8 - r.top) / (r.height + vh * 0.3))))
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <section className="block" id="how">
      <div className="wrap">
        <div className="head">
          <h2 className="h2">From brief to delivered in four steps.</h2>
          <p>How a collaboration runs on Crewaa today.</p>
        </div>
        <div className="timeline" ref={ref}>
          <div className="rail"><i style={{ ["--p" as string]: p.toFixed(3) }} /></div>
          {STEPS.map(([b, t], k) => (
            <div key={b} className={`tstep ${p >= k / STEPS.length + 0.02 || p === 1 ? "lit" : ""}`}>
              <span className="node">{k + 1}</span><b>{b}</b><p>{t}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function GrowBand() {
  return (
    <div className="grow" id="grow">
      <div className="wrap">
        <div className="tag"><i />Crewaa Grow <span className="soon">Coming soon</span></div>
        <h2 className="h2">Run your business. We&apos;ll grow it online.</h2>
        <p className="lead">Grow will be a service, not another tool to learn. Our team does the work, and you see every campaign, lead and result in your Crewaa dashboard.</p>
        <div className="svcs">
          {["Meta ads", "Lead generation", "Google Business Profile", "Websites", "SEO", "Social media management", "Creator campaigns", "Monthly growth reports"].map((s) => <span key={s}>{s}</span>)}
        </div>
        <Link className="btn gold" href="/grow">See what&apos;s coming</Link>
      </div>
    </div>
  )
}

export function FinalCta() {
  return (
    <div className="wrap">
      <div className="final" id="join">
        <CrewaaMark className="bigmark" />
        <h2 className="h2">Join the crew<span style={{ color: "var(--gold)" }}>.</span></h2>
        <p>Free to join. Pick how you&apos;ll use Crewaa, and add more whenever you like.</p>
        <div className="cta-row">
          <Link className="btn p" href="/signup/brand">Join as a brand</Link>
          <Link className="btn line" href="/signup/influencer">Join as a creator</Link>
        </div>
      </div>
    </div>
  )
}
