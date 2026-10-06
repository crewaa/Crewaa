import { api } from "./axios"

/** Waitlists for parts that have not launched (VERSION-3-PLAN.md decision 12). */
export type WaitlistProduct = "ai_influencers"

export const WAITLIST_LABEL: Record<WaitlistProduct, string> = {
  ai_influencers: "AI Influencers",
}

export interface WaitlistEntry {
  id: number
  product: WaitlistProduct
  email: string
  name: string | null
  company: string | null
  user_id: number | null
  created_at: string
}

export async function joinWaitlist(body: { product: WaitlistProduct; email: string; company?: string; name?: string }) {
  await api.post("/waitlist", body)
}

export async function listWaitlist(product?: WaitlistProduct): Promise<{ entries: WaitlistEntry[]; total: number }> {
  const res = await api.get("/admin/waitlist", { params: product ? { product } : undefined })
  return res.data
}
