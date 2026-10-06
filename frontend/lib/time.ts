/**
 * The API stores times as naive UTC (TIMESTAMP WITHOUT TIME ZONE) and returns
 * them without an offset, e.g. "2026-10-06T09:00:00". `new Date()` reads such a
 * string as *local* time, which shifted every "last updated" in India by 5½
 * hours. Treat offset-less timestamps as UTC.
 */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value)
  const d = new Date(hasZone ? value : `${value}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "just now", "3 hours ago", "4 days ago" */
export function timeAgo(date: Date, now: Date = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000))
  if (s < 60) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? "" : "s"} ago`
}

export function daysSince(date: Date, now: Date = new Date()): number {
  return (now.getTime() - date.getTime()) / 86_400_000
}
