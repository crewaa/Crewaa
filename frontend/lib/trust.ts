import { api } from "./axios"

export type ReportReason =
  | "spam"
  | "harassment"
  | "scam"
  | "impersonation"
  | "off_platform"
  | "other"

/** Labels a person can actually pick between, in the order they're offered. */
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "harassment", label: "Harassment or abuse" },
  { value: "scam", label: "Scam or fraud" },
  { value: "impersonation", label: "Pretending to be someone else" },
  { value: "off_platform", label: "Pushing the deal off Crewaa" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Something else" },
]

export interface BlockState {
  blocked: boolean
  blocked_by_me: boolean
}

export interface Dispute {
  id: number
  status: "open" | "resolved" | "dismissed"
  reason: string
  detail: string
  created_at: string
  raised_by_me: boolean
  resolution_note?: string | null
}

export interface VerificationState {
  status: "unverified" | "pending" | "verified" | "rejected"
  requested_at?: string | null
  reviewed_at?: string | null
  note?: string | null
}

export async function getBlockState(interestId: number): Promise<BlockState> {
  const res = await api.get(`/trust/block/${interestId}`)
  return res.data
}

export async function blockCounterpart(interestId: number): Promise<BlockState> {
  const res = await api.post("/trust/block", { interest_id: interestId })
  return res.data
}

export async function unblockCounterpart(interestId: number): Promise<BlockState> {
  const res = await api.post("/trust/unblock", { interest_id: interestId })
  return res.data
}

export async function reportCounterpart(
  interestId: number,
  reason: ReportReason,
  detail?: string,
): Promise<void> {
  await api.post("/trust/report", {
    interest_id: interestId,
    reason,
    detail: detail?.trim() || undefined,
  })
}

export async function listDisputes(interestId: number): Promise<Dispute[]> {
  const res = await api.get(`/trust/disputes/${interestId}`)
  return res.data
}

export async function raiseDispute(
  interestId: number,
  reason: string,
  detail: string,
): Promise<Dispute> {
  const res = await api.post(`/trust/disputes/${interestId}`, { reason, detail })
  return res.data
}

export async function getVerification(): Promise<VerificationState> {
  const res = await api.get("/trust/verification")
  return res.data
}

export async function requestVerification(): Promise<VerificationState> {
  const res = await api.post("/trust/verification")
  return res.data
}
