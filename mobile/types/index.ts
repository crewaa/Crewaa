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

export interface ProfileStatus {
  has_profile: boolean;
  has_social_handles: boolean;
  is_complete: boolean;
  missing?: string[];
}

export interface CreatorProfile {
  id?: number;
  user_id?: number;
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
  id?: number;
  user_id?: number;
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

export type SignalStatus = 'good' | 'warn' | 'bad' | 'unknown';
export type AuthenticityLevel = 'high' | 'medium' | 'low' | 'insufficient';

export interface AuthenticitySignal {
  key: string;
  label: string;
  status: SignalStatus;
  value?: string | null;
  detail: string;
}

export interface AuthenticityPlatformReport {
  platform: 'instagram' | 'youtube';
  score: number | null;
  level: AuthenticityLevel;
  signals: AuthenticitySignal[];
  audience?: number | null;
  computed_at: string;
}

export interface AuthenticityReportResponse {
  creator_id: number;
  reports: AuthenticityPlatformReport[];
  disclaimer?: string;
}

export interface AuthenticitySummary {
  level: AuthenticityLevel;
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

export interface InstagramProfile {
  id: number;
  full_name: string;
  username: string;
  profile_picture?: string | null;
  followers: number;
  following: number;
  posts_count: number;
  bio?: string | null;
  is_verified: boolean;
  scraped_at: string;
}

export interface InstagramPost {
  id: number;
  shortcode: string;
  likes: number;
  comments: number;
  views?: number | null;
  caption?: string | null;
  posted_at: string;
  is_video: boolean;
  scraped_at: string;
}

export interface InstagramAnalyticsResponse {
  status: 'success' | 'no_data' | 'error';
  message?: string;
  profile: InstagramProfile | null;
  posts: InstagramPost[];
}

export interface YouTubeChannel {
  id: number;
  channel_id?: string;
  username?: string | null;
  title: string;
  description?: string | null;
  profile_picture?: string | null;
  custom_url?: string | null;
  subscribers: number;
  total_views: number;
  video_count?: number;
  total_videos?: number;
  is_verified?: boolean;
  scraped_at: string;
}

export interface YouTubeVideo {
  id: number;
  video_id: string;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  views: number;
  likes: number;
  comments: number;
  duration?: string | null;
  published_at: string;
  scraped_at?: string;
}

export interface YouTubeAnalyticsResponse {
  status: 'success' | 'no_data' | 'error';
  message?: string;
  channel: YouTubeChannel | null;
  videos: YouTubeVideo[];
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

export interface RankedCreator {
  creator_id: string;
  creator_name?: string;
  fit_level: string;
  score_reasoning?: string[];
  risks?: string[];
  recommended_campaign_type?: string;
  category?: string;
  location?: string;
  primary_platform?: string;
  bio?: string;
  instagram_username?: string;
  instagram_url?: string;
  youtube_username?: string;
  youtube_url?: string;
  followers?: number;
  subscribers?: number;
  avg_likes?: number;
  avg_comments?: number;
  engagement_rate?: number;
  is_verified?: boolean;
  authenticity?: AuthenticitySummary | null;
}

export interface DiscoverResult {
  ranked_creators: RankedCreator[];
  final_recommendation?: string;
  campaign_id?: number | null;
  campaign_name?: string | null;
  criteria_source?: 'campaign' | 'custom';
  follower_floor_relaxed?: boolean;
}

export interface InterestedCreator {
  interest_id: number;
  creator_id: number;
  creator_name?: string;
  email: string;
  category?: string;
  location?: string;
  instagram_username?: string;
  youtube_username?: string;
  followers?: number;
  engagement_rate?: number;
  authenticity?: AuthenticitySummary | null;
  message?: string;
  campaign_type?: string;
  created_at: string;
}

export interface InterestedCreatorsResponse {
  creators: InterestedCreator[];
  total: number;
}

export interface CreatorSummary {
  generated_at?: string | null;
  is_stale?: boolean;
  creator_id?: string;
  summary?: string;
  strengths?: string[];
  improvement_areas?: string[];
  best_brand_categories?: string[];
  recommended_content_formats?: string[];
}

export interface NotificationItem {
  id: number;
  kind: 'message' | 'offer' | 'delivery' | 'review' | 'interest' | 'crew' | string;
  title: string;
  body: string;
  link: string;
  created_at: string;
  read: boolean;
}

export interface UnreadCountResponse {
  unread: number;
}

export interface CampaignInput {
  name: string;
  niche: string;
  campaign_goal: string;
  campaign_type: string;
  budget_per_creator?: number | null;
  currency?: string;
  deliverables?: string[] | null;
  deadline?: string | null;
  brief?: string | null;
  platform_preferences?: string[] | null;
  target_location?: string | null;
  min_followers?: number | null;
  creators_needed?: number | null;
  is_open_to_applications?: boolean;
}
