import { api } from "./axios"

// --- Types ---
export interface PlatformStats {
  total_users: number
  total_creators: number
  total_brands: number
  total_admins: number
  new_users_last_7_days: number
}

export interface AdminUserListItem {
  id: number
  email: string
  role: string
  is_active: boolean
  has_profile: boolean
  created_at: string
}

export interface AdminUserDetail {
  id: number
  email: string
  role: string
  is_active: boolean
  created_at: string
  // Creator
  creator_full_name?: string
  creator_location?: string
  creator_category?: string
  creator_primary_platform?: string
  creator_instagram_username?: string
  creator_youtube_username?: string
  creator_bio?: string
  creator_profile_completed?: boolean
  /** Named fields still to fill in, so the flag is actionable. */
  creator_profile_missing?: string[]
  // Brand
  brand_name?: string
  brand_industry?: string
  brand_description?: string
  brand_website?: string
  brand_campaign_goal?: string
  brand_budget_range?: string
  brand_profile_completed?: boolean
  brand_profile_missing?: string[]
}

export interface PaginatedUsers {
  items: AdminUserListItem[]
  total: number
  page: number
  page_size: number
}

// --- API Calls ---
export async function getAdminStats(): Promise<PlatformStats> {
  const res = await api.get("/admin/stats")
  return res.data
}

export async function getAdminUsers(params?: {
  role?: string
  search?: string
  page?: number
  page_size?: number
}): Promise<PaginatedUsers> {
  const res = await api.get("/admin/users", { params })
  return res.data
}

export async function getAdminUserDetail(id: number): Promise<AdminUserDetail> {
  const res = await api.get(`/admin/users/${id}`)
  return res.data
}

export async function deleteAdminUser(id: number): Promise<void> {
  await api.delete(`/admin/users/${id}`)
}

export async function createAdminUser(data: {
  email: string
  password: string
  role: string
}): Promise<AdminUserDetail> {
  const res = await api.post("/admin/users", data)
  return res.data
}

// ---------------------------------------------------------------------------
// Trust & safety queues (V2 Phase 3)
// ---------------------------------------------------------------------------

export interface AdminReport {
  id: number
  reporter_id: number
  reporter_email: string
  reported_id: number
  reported_email: string
  interest_id: number | null
  reason: string
  detail: string | null
  status: string
  created_at: string
  admin_note: string | null
}

export interface AdminDispute {
  id: number
  interest_id: number
  raised_by_id: number
  raised_by_email: string
  reason: string
  detail: string
  status: string
  created_at: string
  resolution_note: string | null
}

export interface AdminVerification {
  user_id: number
  email: string
  role: string
  status: string
  requested_at: string | null
}

export interface TrustCounts {
  reports: Record<string, number>
  open_disputes: number
  pending_verifications: number
}

export async function getTrustCounts(): Promise<TrustCounts> {
  const res = await api.get("/admin/trust/reports/counts")
  return res.data
}

export async function listReports(status = "open"): Promise<AdminReport[]> {
  const res = await api.get("/admin/trust/reports", { params: { status } })
  return res.data
}

export async function resolveReport(
  id: number,
  status: "reviewed" | "actioned" | "dismissed",
  note?: string,
): Promise<AdminReport> {
  const res = await api.post(`/admin/trust/reports/${id}`, { status, note })
  return res.data
}

export async function listAdminDisputes(status = "open"): Promise<AdminDispute[]> {
  const res = await api.get("/admin/trust/disputes", { params: { status } })
  return res.data
}

export async function resolveDispute(
  id: number,
  status: "resolved" | "dismissed",
  note: string,
): Promise<AdminDispute> {
  const res = await api.post(`/admin/trust/disputes/${id}`, { status, note })
  return res.data
}

export async function listVerifications(): Promise<AdminVerification[]> {
  const res = await api.get("/admin/trust/verifications")
  return res.data
}

export async function reviewVerification(
  userId: number,
  approve: boolean,
  note?: string,
): Promise<AdminVerification> {
  const res = await api.post(`/admin/trust/verifications/${userId}`, { approve, note })
  return res.data
}
