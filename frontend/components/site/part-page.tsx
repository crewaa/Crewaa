import { CrewaaMark } from "./crewaa-mark"
import { partById, type SitePart } from "./parts-data"

/** Shared layout for the five public part pages (V3 Phase 3). */
export function PartPage({
  part,
  title,
  lead,
  children,
  hero,
}: {
  part: SitePart["id"]
  title: string
  lead: string
  /** Sections under the hero. */
  children?: React.ReactNode
  /** Extra content inside the hero (buttons, waitlist form). */
  hero?: React.ReactNode
}) {
  const p = partById(part)
  return (
    <main style={{ ["--c" as string]: p.color }}>
      <header className="phero" style={{ ["--c" as string]: p.color }}>
        <CrewaaMark className="pmark" />
        <div className="wrap">
          <div className="ptag"><i />{p.name}<span style={{ color: "var(--muted)", fontWeight: 500 }}>{p.forWho}</span>{p.soon && <span className="soon">Coming soon</span>}</div>
          <h1>{title}</h1>
          <p className="lead">{lead}</p>
          {hero}
        </div>
      </header>
      {children}
      <div style={{ height: 120 }} />
    </main>
  )
}

export function FeatureGrid({ items }: { items: [string, string][] }) {
  return (
    <section className="wrap">
      <div className="pgrid">
        {items.map(([b, t]) => (
          <div key={b}><b>{b}</b><p>{t}</p></div>
        ))}
      </div>
    </section>
  )
}

export function Steps({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <section className="block wrap" style={{ paddingTop: 110 }}>
      <div className="head"><h2 className="h2">{title}</h2></div>
      <ol className="psteps">
        {items.map(([b, t]) => (
          <li key={b}><div><b>{b}</b><span>{t}</span></div></li>
        ))}
      </ol>
    </section>
  )
}
