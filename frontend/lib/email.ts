import { api } from "./axios"

/** Email notification settings (V3 Phase 4). */
export interface EmailPreferences {
  messages: boolean
  deals: boolean
  crew: boolean
  /** False when the server has no email provider configured yet. */
  email_enabled: boolean
}

export type EmailCategory = "messages" | "deals" | "crew"

export async function getEmailPreferences(): Promise<EmailPreferences> {
  const res = await api.get("/email/preferences")
  return res.data
}

export async function updateEmailPreferences(changes: Partial<Record<EmailCategory, boolean>>): Promise<EmailPreferences> {
  const res = await api.put("/email/preferences", changes)
  return res.data
}

export async function unsubscribe(token: string): Promise<{ status: string; category: string; label: string }> {
  const res = await api.post("/email/unsubscribe", null, { params: { token } })
  return res.data
}
