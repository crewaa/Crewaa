"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { CrewaaMark } from "../crewaa-mark"
import { SITE_PARTS } from "../parts-data"

const COPY: Record<string, { h: string; p: string; points: string[] }> = {
  collabs: {
    h: "Brand and creator collaborations, start to finish.",
    p: "Post a campaign and get an AI-ranked shortlist of creators. Then chat, agree terms and track delivery without leaving Crewaa.",
    points: ["AI matching on real Instagram and YouTube data", "An Authenticity Score on every creator", "Agreed terms, proof of posting and two-way reviews"],
  },
  grow: {
    h: "Your online growth team, delivered.",
    p: "Our team will run your ads, find you leads and build your presence online, and you'll follow every step from your dashboard.",
    points: ["Meta ads planned, run and reported", "Lead generation", "Google profile, website, SEO and social media"],
  },
  ai: {
    h: "An influencer made for your brand.",
    p: "Create an AI influencer with your brand's look and voice, and produce content whenever you need it. Every post clearly labelled as AI-generated.",
    points: ["A consistent face and voice for your brand", "Reels and posts on your schedule", "Clear AI labelling on everything"],
  },
  suite: {
    h: "Plan, write and measure in one place.",
    p: "Content ideas, captions, ad copy, content calendars and growth reports. The AI tools a marketing team uses, for brands and creators alike.",
    points: ["Captions and ad copy in your voice", "A content calendar that fills itself", "Growth reports from your real data"],
  },
  crew: {
    h: "Hire your crew. Keep creating.",
    p: "Video editors, script writers, thumbnail designers and more, from our in-house team and vetted freelancers.",
    points: ["Editors, writers and designers", "In-house team and vetted freelancers", "Thumbnails and post designs"],
  },
}

function Scenes({ active }: { active: number }) {
  const on = (i: number) => `scene ${active === i ? "on" : ""}`
  return (
    <>
      <div className={on(0)}>
        <div className="sc-collab">
          <svg viewBox="0 0 400 260" preserveAspectRatio="none" aria-hidden="true"><path className="flow" d="M120 60 C 260 60, 140 200, 290 200" /></svg>
          <div className="p a glass"><span className="av" style={{ background: "var(--c-collabs)" }}>AK</span><div><b>Ananya Kulkarni</b><small>Food creator, Pune</small></div></div>
          <span className="agreed">Terms agreed</span>
          <div className="p b glass"><span className="av" style={{ background: "var(--gold)", borderRadius: 12 }}>S</span><div><b>Skincare launch</b><small>3 reels, 2 stories</small></div></div>
        </div>
      </div>
      <div className={on(1)}>
        <div className="sc-grow glass">
          <div className="sub">Example: qualified leads this month</div>
          <div className="n">312</div>
          <svg viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="lp-gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D8B45A" stopOpacity=".35" /><stop offset="1" stopColor="#D8B45A" stopOpacity="0" /></linearGradient></defs>
            <path d="M0 100 L40 92 L80 96 L120 74 L160 78 L200 52 L240 50 L300 14 L300 120 L0 120Z" fill="url(#lp-gg)" />
            <path className="gl" pathLength={1} d="M0 100 L40 92 L80 96 L120 74 L160 78 L200 52 L240 50 L300 14" fill="none" stroke="#D8B45A" strokeWidth="2.5" />
            <circle cx="300" cy="14" r="4" fill="#F1DA97" />
          </svg>
          <div className="tags"><span>Meta ads</span><span>Google profile</span><span>SEO</span></div>
        </div>
      </div>
      <div className={on(2)}>
        <div className="sc-ai">
          <div className="face"><span className="lab">AI-generated</span><span className="shine" /></div>
          <div className="reels">
            <div className="reel glass"><b>Reel 1</b><span>Ready</span></div>
            <div className="reel glass"><b>Reel 2</b><span>Ready</span></div>
            <div className="reel glass"><b>Reel 3</b><span>Rendering</span></div>
          </div>
        </div>
      </div>
      <div className={on(3)}>
        <div className="sc-suite glass">
          <div className="sub" style={{ color: "var(--muted)", fontSize: 14 }}>Content plan</div>
          <div className="cal">
            {"_x_z_y__z_x__x__y_xz_x".split("").map((c, i) => (
              <span key={i} className={c === "_" ? "" : c} />
            ))}
          </div>
          <div className="caption"><b>Caption draft</b><span className="typing">Festive drop is here. Three looks, one weekend</span></div>
        </div>
      </div>
      <div className={on(4)}>
        <div className="sc-crew">
          <div className="sub">Example: how requests will look</div>
          <div className="t glass"><span className="av">VE</span><div><b>Reel edit</b><small>Video editor</small></div><span className="st done">Delivered</span></div>
          <div className="t glass"><span className="av">SW</span><div><b>YouTube script</b><small>Script writer</small></div><span className="st wip">In progress</span></div>
          <div className="t glass"><span className="av">TD</span><div><b>Thumbnail set</b><small>Designer</small></div><span className="st wip">Starts Monday</span></div>
        </div>
      </div>
    </>
  )
}

export function Parts() {
  const [active, setActive] = useState(0)
  const refs = useRef<(HTMLElement | null)[]>([])

  // The sticky stage follows whichever part is in the middle of the screen.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.i))),
      { rootMargin: "-45% 0px -45% 0px" },
    )
    refs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])

  const part = SITE_PARTS[active]

  return (
    <section className="block" id="parts">
      <div className="wrap">
        <div className="head">
          <h2 className="h2">Five ways to grow, in one platform.</h2>
          <p>Each part has its own colour, so you always know where you are. Brands and businesses get four of them. Creators get three.</p>
        </div>
        <div className="parts">
          <div className="pstage-wrap">
            <div className="pstage" data-i={active} style={{ ["--c" as string]: part.color }}>
              <CrewaaMark className="ghost" />
              <div className="pname-big"><i />{part.name}</div>
              <div className="pcount">{active + 1} of 5</div>
              <Scenes active={active} />
            </div>
          </div>
          <div className="ptexts">
            {SITE_PARTS.map((p, i) => {
              const c = COPY[p.id]
              return (
                <article key={p.id} className="part" data-i={i} ref={(el) => { refs.current[i] = el }} style={{ ["--c" as string]: p.color }}>
                  <div className="tag"><i />{p.name} <em>{p.forWho}</em>{p.soon && <span className="soon">Coming soon</span>}</div>
                  <h3>{c.h}</h3>
                  <p>{c.p}</p>
                  <ul>{c.points.map((pt) => <li key={pt}>{pt}</li>)}</ul>
                  <Link className="go" href={p.href}>{p.soon ? `What's coming in ${p.short}` : `Explore ${p.short}`} <span /></Link>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
