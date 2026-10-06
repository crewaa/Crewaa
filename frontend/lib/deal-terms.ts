import { api } from "./axios"

/**
 * Deal terms — what this brand and this creator actually agreed (V2 §1.2).
 *
 * Distinct from the campaign's terms, which are the brand's general offer to
 * anyone who fits. These are the specific numbers for this pair, and they can
 * differ after a negotiation.
 *
 * `fee` is a string, not a number, deliberately: it comes off a `Numeric`
 * column and parsing it into a JS float is how ₹30,000.10 quietly becomes
 * ₹30,000.099999999. Format it, compare it, but do not do arithmetic on it.
 */
export interface Offer {
  id: number
  status: "proposed" | "superseded" | "accepted" | "declined" | "withdrawn"
  proposed_by_id: number
  proposed_by_role: "brand" | "creator"
  is_mine: boolean

  fee: string
  currency: string
  deliverables?: string[] | null
  deadline?: string | null
  note?: string | null

  supersedes_id?: number | null
  created_at: string
  responded_at?: string | null
}

export interface DealTerms {
  interest_id: number
  /** The live offer awaiting a response. */
  current?: Offer | null
  /** Set once terms are agreed; never changes afterwards. */
  agreed?: Offer | null
  history: Offer[]

  /** Server-decided, so the UI never renders a control the API would reject. */
  can_propose: boolean
  can_respond: boolean
  can_withdraw: boolean
}

export interface OfferInput {
  fee: string
  currency?: string
  deliverables?: string[] | null
  deadline?: string | null
  note?: string | null
}

export async function getTerms(interestId: number): Promise<DealTerms> {
  const res = await api.get(`/deals/${interestId}/terms`)
  return res.data
}

export async function proposeTerms(
  interestId: number,
  data: OfferInput
): Promise<DealTerms> {
  const res = await api.post(`/deals/${interestId}/terms`, data)
  return res.data
}

/** accept | decline | withdraw — all return the refreshed negotiation. */
export async function respondToOffer(
  interestId: number,
  offerId: number,
  action: "accept" | "decline" | "withdraw"
): Promise<DealTerms> {
  const res = await api.post(`/deals/${interestId}/terms/${offerId}/${action}`)
  return res.data
}

/** "30000.00" -> "₹30,000" — currency-aware, no floating point involved. */
export function formatFee(fee: string, currency = "INR"): string {
  const symbol = currency === "INR" ? "₹" : `${currency} `
  const [whole, decimals] = fee.split(".")
  const grouped = Number(whole).toLocaleString("en-IN")
  const cents = decimals && decimals !== "00" ? `.${decimals}` : ""
  return `${symbol}${grouped}${cents}`
}

// ---------------------------------------------------------------------------
// Delivery (V2 §1.4)
// ---------------------------------------------------------------------------

export interface Delivery {
  id: number
  label: string
  url: string
  note?: string | null
  status: "submitted" | "approved" | "changes_requested" | "superseded"
  feedback?: string | null
  submitted_by_id: number
  is_mine: boolean
  supersedes_id?: number | null
  created_at: string
  reviewed_at?: string | null
}

export interface DeliveryState {
  /** Null until terms are agreed — there is nothing to deliver against. */
  offer_id?: number | null
  complete: boolean
  outstanding: string[]
  approved_count: number
  expected_count: number
  submissions: Delivery[]
  can_submit: boolean
  can_review: boolean
}

export async function getDelivery(interestId: number): Promise<DeliveryState> {
  const res = await api.get(`/deals/${interestId}/delivery`)
  return res.data
}

export async function submitDelivery(
  interestId: number,
  data: { label: string; url: string; note?: string | null }
): Promise<DeliveryState> {
  const res = await api.post(`/deals/${interestId}/delivery`, data)
  return res.data
}

export async function reviewDelivery(
  interestId: number,
  deliveryId: number,
  approve: boolean,
  feedback?: string
): Promise<DeliveryState> {
  const res = await api.post(
    `/deals/${interestId}/delivery/${deliveryId}/review`,
    { approve, feedback }
  )
  return res.data
}

// ---------------------------------------------------------------------------
// Reviews (V2 §1.5)
// ---------------------------------------------------------------------------

export interface Review {
  id: number
  rating: number
  comment?: string | null
  author_role: "brand" | "creator"
  created_at: string
}

export interface ReviewState {
  mine?: Review | null
  /**
   * Theirs — null until revealed. A hidden review is deliberately
   * indistinguishable from one that was never written.
   */
  received?: Review | null
  revealed: boolean
  can_review: boolean
  blocked_reason?: string | null
}

export async function getReviews(interestId: number): Promise<ReviewState> {
  const res = await api.get(`/deals/${interestId}/review`)
  return res.data
}

export async function submitReview(
  interestId: number,
  rating: number,
  comment?: string
): Promise<ReviewState> {
  const res = await api.post(`/deals/${interestId}/review`, { rating, comment })
  return res.data
}

/** A user's track record: revealed reviews only (GET /deals/reviews/user/{id}). */
export interface PublicReviews {
  user_id: number
  average_rating?: number | null
  review_count: number
  reviews: Review[]
}

export async function getPublicReviews(userId: number): Promise<PublicReviews> {
  const res = await api.get(`/deals/reviews/user/${userId}`)
  return res.data
}
