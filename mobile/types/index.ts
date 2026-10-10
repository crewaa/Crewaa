/**
 * Shared API & Domain Types for Crewaa Mobile
 * Mirrored from frontend/lib/types.ts and backend schemas
 */

export type Role = 'BRAND' | 'INFLUENCER' | 'ADMIN';

export interface CurrentUser {
  id: number;
  email: string;
  role: Role;
}

export interface CreatorProfile {
  id: number;
  user_id: number;
  full_name: string;
  location: string;
  primary_platform: string;
  category: string;
  instagram_username?: string | null;
  instagram_profile_link?: string | null;
  youtube_username?: string | null;
  youtube_profile_link?: string | null;
  bio?: string | null;
}

export interface BrandProfile {
  id: number;
  user_id: number;
  brand_name: string;
  industry: string;
  description?: string | null;
  website?: string | null;
  logo_url?: string | null;
  campaign_goal: string;
  budget_range: string;
  target_location?: string | null;
  target_languages?: string | null;
  platform_preferences?: string | null;
}

export interface AuthenticitySummary {
  level: 'high' | 'medium' | 'low' | 'insufficient';
  score?: number | null;
  flagged_signals?: string[];
  disclaimer: string;
}

export interface SavedCreator {
  id: number;
  brand_id: number;
  creator_id: number;
  fit_level: string;
  score_reasoning?: string | null;
  saved_at: string;
  creator_name?: string | null;
  creator_category?: string | null;
  creator_platform?: string | null;
  authenticity?: AuthenticitySummary | null;
}

export interface ScrapeStatus {
  status: 'none' | 'running' | 'success' | 'error';
  message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface BrandDeal {
  opportunity_id: string;
  fit_level?: string;
  industry_hint?: string;
  campaign_type?: string;
  campaign_requirements?: string;
  compensation?: string;
  timeline?: string;
  deliverables?: string[];
  status?: string;
  budget_range?: string;
  terms_are_estimated?: boolean;
  interested?: boolean;
  budget_per_creator?: number | null;
  currency?: string | null;
  deadline?: string | null;
  what_to_expect?: string | null;
  why_it_fits?: string[] | null;
}

export interface Campaign {
  id: number;
  name: string;
  status: 'draft' | 'active' | 'closed';
  niche: string;
  campaign_goal: string;
  campaign_type: string;
  budget_per_creator?: number | null;
  currency: string;
  deliverables?: string[] | null;
  deadline?: string | null;
  brief?: string | null;
  platform_preferences?: string[] | null;
  target_location?: string | null;
  min_followers?: number | null;
  creators_needed?: number | null;
  is_open_to_applications: boolean;
  created_at: string;
  interested_count: number;
}

export interface Offer {
  id: number;
  status: 'proposed' | 'superseded' | 'accepted' | 'declined' | 'withdrawn';
  proposed_by_id: number;
  proposed_by_role: 'brand' | 'creator';
  is_mine: boolean;
  fee: string;
  currency: string;
  deliverables?: string[] | null;
  deadline?: string | null;
  note?: string | null;
  supersedes_id?: number | null;
  created_at: string;
  responded_at?: string | null;
}

export interface DealTerms {
  interest_id: number;
  current?: Offer | null;
  agreed?: Offer | null;
  history: Offer[];
  can_propose: boolean;
  can_respond: boolean;
  can_withdraw: boolean;
}

export interface Counterpart {
  user_id: number;
  name: string;
  subtitle?: string;
  location?: string;
}

export interface MessageOut {
  id: number;
  sender_id: number;
  body: string;
  created_at: string;
  read_at?: string;
  is_mine: boolean;
}

export interface ThreadSummary {
  interest_id: number;
  counterpart: Counterpart;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  interest_status: string;
}

export interface ThreadDetail {
  interest_id: number;
  counterpart: Counterpart;
  interest_status: string;
  messages: MessageOut[];
}
