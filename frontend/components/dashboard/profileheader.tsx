"use client"

import { useState } from "react"
import { BadgeCheck, ExternalLink, Instagram, Youtube, User } from "lucide-react"
import { parseApiDate } from "@/lib/time"
import { getSafeImageUrl } from "@/lib/images"

export interface ProfileData {
  full_name?: string
  username: string
  profile_picture?: string | null
  bio?: string
  is_verified?: boolean
  scraped_at?: string
  followers?: number
  following?: number
  posts_count?: number
  subscribers?: number
  total_views?: number
  total_videos?: number
  platform?: "youtube" | "instagram"
  channel_url?: string
}

interface ProfileHeaderProps {
  profile: ProfileData
  platform?: "youtube" | "instagram"
}

function ProfileHeader({ profile, platform }: ProfileHeaderProps) {
  const [imgError, setImgError] = useState(false)

  const isYoutube =
    platform === "youtube" ||
    profile.platform === "youtube" ||
    profile.subscribers !== undefined ||
    profile.total_videos !== undefined ||
    profile.total_views !== undefined

  const cleanUsername = (profile.username || "").replace(/^@/, "").trim()

  const profileUrl = isYoutube
    ? (profile.channel_url || (cleanUsername ? `https://youtube.com/@${cleanUsername}` : "https://youtube.com"))
    : (cleanUsername ? `https://instagram.com/${cleanUsername}` : "https://instagram.com")

  const hasImage = Boolean(profile.profile_picture && profile.profile_picture.trim()) && !imgError

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-peacock-surface to-peacock-deep p-6 sm:p-7 shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        {/* Avatar with Platform Ring and Badge */}
        <div className="relative shrink-0">
          {hasImage ? (
            <img
              src={getSafeImageUrl(profile.profile_picture)}
              alt={profile.username}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover border-2 shadow-md transition"
              style={{ borderColor: isYoutube ? "#FF0000" : "#E1306C" }}
            />
          ) : (
            <div
              className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full border-2 shadow-md"
              style={{
                borderColor: isYoutube ? "#FF0000" : "#E1306C",
                backgroundColor: isYoutube ? "rgba(255, 0, 0, 0.12)" : "rgba(225, 48, 108, 0.12)",
              }}
            >
              {isYoutube ? (
                <Youtube className="h-10 w-10 text-red-500" />
              ) : (
                <Instagram className="h-10 w-10 text-pink-500" />
              )}
            </div>
          )}

          {/* Platform Badge on Avatar */}
          <div
            className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-peacock-surface shadow-sm"
            style={{ backgroundColor: isYoutube ? "#FF0000" : "#E1306C" }}
            title={isYoutube ? "YouTube Channel" : "Instagram Profile"}
          >
            {isYoutube ? (
              <Youtube className="h-3 w-3 text-white" />
            ) : (
              <Instagram className="h-3 w-3 text-white" />
            )}
          </div>
        </div>

        {/* Profile Details */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl sm:text-3xl font-bold font-display text-white tracking-tight">
                {profile.full_name || profile.username}
              </h2>
              {profile.is_verified && (
                <BadgeCheck
                  className="h-5 w-5 text-sky-400 shrink-0"
                  aria-label="Verified account"
                />
              )}
            </div>

            {/* Direct Open Link */}
            {cleanUsername && (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition hover:scale-105 ${
                  isYoutube
                    ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                    : "border-pink-500/30 bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 hover:text-pink-300"
                }`}
              >
                {isYoutube ? (
                  <Youtube className="h-3.5 w-3.5" />
                ) : (
                  <Instagram className="h-3.5 w-3.5" />
                )}
                <span>{isYoutube ? "View Channel" : "View Profile"}</span>
                <ExternalLink className="h-3 w-3 opacity-70" />
              </a>
            )}
          </div>

          <p className="mt-1 text-sm font-medium text-gray-400">
            @{cleanUsername}
          </p>

          <p className="mt-2.5 text-sm leading-relaxed text-gray-300 line-clamp-3">
            {profile.bio || "No bio provided"}
          </p>

          {profile.scraped_at && (
            <p className="mt-3 text-xs text-gray-500">
              Last synced: {parseApiDate(profile.scraped_at)?.toLocaleString() ?? "—"}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProfileHeader
