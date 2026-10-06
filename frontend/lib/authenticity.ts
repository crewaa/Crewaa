import { api } from "./axios"

export type SignalStatus = "good" | "warn" | "bad" | "unknown"
export type AuthenticityLevel = "high" | "medium" | "low" | "insufficient"

export interface AuthenticitySignal {
  key: string
  label: string
  status: SignalStatus
  value?: string | null
  detail: string
}

export interface AuthenticityPlatformReport {
  platform: "instagram" | "youtube"
  score: number | null
  level: AuthenticityLevel
  signals: AuthenticitySignal[]
  audience?: number | null
  computed_at: string
}

export interface AuthenticityReportResponse {
  creator_id: number
  reports: AuthenticityPlatformReport[]
  disclaimer: string
}

/** Headline shown on creator cards in brand screens. */
export interface AuthenticitySummary {
  score: number | null
  level: AuthenticityLevel
  platform?: string | null
  computed_at?: string | null
  highlights: string[]
}

export async function getAuthenticity(userId: number): Promise<AuthenticityReportResponse> {
  const res = await api.get(`/authenticity/${userId}`)
  return res.data
}

/** Wording is deliberate: never "fake" (VERSION-3-PLAN.md §4). */
export const LEVEL_COPY: Record<AuthenticityLevel, { label: string; tone: string; ring: string; dot: string }> = {
  high: { label: "High authenticity", tone: "text-peacock-ok", ring: "#86D36B", dot: "bg-peacock-ok" },
  medium: { label: "Some concerns", tone: "text-peacock-gold", ring: "#D8B45A", dot: "bg-peacock-gold" },
  low: { label: "Low authenticity", tone: "text-peacock-danger", ring: "#F2716B", dot: "bg-peacock-danger" },
  insufficient: { label: "Not enough data yet", tone: "text-peacock-muted", ring: "#4E7171", dot: "bg-gray-600" },
}
