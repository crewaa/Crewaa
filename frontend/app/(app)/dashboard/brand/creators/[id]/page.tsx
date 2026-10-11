"use client"

/**
 * A creator's profile as a brand sees it (V3 Phase 3) — the page behind
 * "View complete profile". Public stats plus the full Authenticity report.
 * No contact details: those are shared only when the creator expresses interest.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  Instagram,
  Loader2,
  MapPin,
  MessageCircle,
  Star,
  User,
  Youtube,
} from "lucide-react"

import { getCreatorForBrand, type CreatorProfileForBrand } from "@/lib/ai"
import { getPublicReviews, type PublicReviews } from "@/lib/deal-terms"
import { getSafeImageUrl } from "@/lib/images"
import { parseApiDate } from "@/lib/time"
import { AuthenticityCard } from "@/components/dashboard/authenticity-card"
import { AuthenticityBadge } from "@/components/dashboard/authenticity-badge"
import { errorMessage } from "@/lib/types"

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
const fmt = (n: number | null | undefined) => (n == null ? "—" : compact.format(n))

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-peacock-surface p-5">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 font-display text-3xl text-white tabular-nums">{value}</p>
    </div>
  )
}

function Reviews({ data }: { data: PublicReviews | null }) {
  if (!data) return null
  return (
    <section className="mt-10 rounded-2xl border border-white/10 bg-peacock-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl text-white">Reviews from brands</h2>
        {data.review_count > 0 && data.average_rating != null && (
          <p className="inline-flex items-center gap-2 text-sm text-gray-300">
            <Star className="h-4 w-4 fill-peacock-gold text-peacock-gold" aria-hidden />
            <span className="font-semibold text-white tabular-nums">{data.average_rating.toFixed(1)}</span>
            from {data.review_count} {data.review_count === 1 ? "review" : "reviews"}
          </p>
        )}
      </div>
      {data.review_count === 0 ? (
        <p className="mt-3 text-sm text-gray-400">No reviews yet. Reviews appear here after a completed collaboration, once both sides have reviewed.</p>
      ) : (
        <ul className="mt-5 divide-y divide-white/10">
          {data.reviews.filter((r) => r.author_role === "brand").slice(0, 10).map((r) => (
            <li key={r.id} className="py-4">
              <div className="flex items-center gap-1" aria-label={`${r.rating} out of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-peacock-gold text-peacock-gold" : "text-gray-600"}`} aria-hidden />
                ))}
                <span className="ml-2 text-xs text-gray-500">{parseApiDate(r.created_at)?.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>
              </div>
              {r.comment && <p className="mt-2 text-sm leading-relaxed text-gray-300">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function BrandCreatorProfilePage() {
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const [creator, setCreator] = useState<CreatorProfileForBrand | null>(null)
  const [error, setError] = useState("")
  const [avatarError, setAvatarError] = useState(false)
  const [reviews, setReviews] = useState<PublicReviews | null>(null)

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) return
    let cancelled = false
    getCreatorForBrand(id)
      .then((c) => { if (!cancelled) setCreator(c) })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, "We couldn't load this creator.")) })
    // Reviews are a bonus: if they fail, the profile still shows.
    getPublicReviews(id)
      .then((r) => { if (!cancelled) setReviews(r) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [id])

  const invalid = !Number.isInteger(id) || id <= 0
  const avatarUrl = creator?.profile_picture || creator?.avatar_url
  const hasAvatar = Boolean(avatarUrl && avatarUrl.trim()) && !avatarError

  return (
    <div className="mx-auto max-w-5xl py-4 px-4 sm:px-6">
      <Link href="/dashboard/analytics/brand" className="inline-flex items-center gap-2 text-sm text-gray-400 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
      </Link>

      {invalid || error ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-peacock-surface p-10 text-center">
          <p className="text-white">{invalid ? "That creator link isn't valid." : error}</p>
        </div>
      ) : !creator ? (
        <div className="mt-8 flex items-center gap-3 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading profile…
        </div>
      ) : (
        <>
          {/* Creator Identity Header Card with Profile Picture */}
          <header className="mt-8 rounded-2xl border border-white/10 bg-gradient-to-br from-peacock-surface to-peacock-deep p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Creator Profile Picture / Avatar */}
              <div className="relative shrink-0">
                {hasAvatar ? (
                  <img
                    src={getSafeImageUrl(avatarUrl!)}
                    alt={creator.creator_name || "Creator profile"}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className="h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover border-2 border-peacock-teal bg-peacock-surface shadow-md"
                  />
                ) : (
                  <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full border-2 border-peacock-teal bg-peacock-surface text-peacock-teal shadow-md">
                    <User className="h-12 w-12 sm:h-14 sm:w-14" />
                  </div>
                )}
              </div>

              {/* Creator Header Info */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-peacock-teal">
                      {[creator.category, creator.primary_platform].filter(Boolean).join(" · ") || "Content Creator"}
                    </p>
                    <h1 className="mt-1.5 flex items-center gap-3 font-display text-3xl font-medium text-white sm:text-4xl md:text-5xl">
                      {creator.creator_name || "Unnamed creator"}
                      {creator.is_verified && (
                        <BadgeCheck className="h-6 w-6 sm:h-7 sm:w-7 text-peacock-blue shrink-0" aria-label="Verified on platform" />
                      )}
                    </h1>
                  </div>

                  {/* Social Direct Navigation Actions */}
                  <div className="flex flex-wrap gap-2.5">
                    {creator.instagram_username && (
                      <a
                        href={creator.instagram_url || `https://instagram.com/${creator.instagram_username.replace(/^@/, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-pink-500/35 bg-peacock-surface px-4 py-2 text-sm font-semibold text-white transition hover:border-pink-500/70 hover:bg-pink-500/10 shadow-sm"
                      >
                        <Instagram className="h-4 w-4 text-pink-500" aria-hidden />
                        <span>@{creator.instagram_username.replace(/^@/, "")}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                      </a>
                    )}
                    {(creator.youtube_username || creator.youtube_url) && (
                      <a
                        href={creator.youtube_url || `https://youtube.com/@${(creator.youtube_username || "").replace(/^@/, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-red-500/35 bg-peacock-surface px-4 py-2 text-sm font-semibold text-white transition hover:border-red-500/70 hover:bg-red-500/10 shadow-sm"
                      >
                        <Youtube className="h-4 w-4 text-red-500" aria-hidden />
                        <span>{creator.youtube_username || "YouTube"}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                      </a>
                    )}
                  </div>
                </div>

                {creator.location && (
                  <p className="mt-2.5 inline-flex items-center gap-1.5 text-sm text-gray-400">
                    <MapPin className="h-4 w-4 text-peacock-teal" aria-hidden /> {creator.location}
                  </p>
                )}

                <div className="mt-3.5">
                  <AuthenticityBadge summary={creator.authenticity} showReason />
                </div>
              </div>
            </div>

            {creator.bio && (
              <p className="mt-6 border-t border-white/10 pt-5 leading-relaxed text-gray-300 text-sm sm:text-base">
                {creator.bio}
              </p>
            )}
          </header>

          {/* Performance Metrics Tiles */}
          <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {creator.subscribers != null && creator.followers == null
              ? <Stat label="Subscribers" value={fmt(creator.subscribers)} />
              : <Stat label="Followers" value={fmt(creator.followers)} />}
            <Stat label="Avg likes" value={fmt(creator.avg_likes)} />
            <Stat label="Avg comments" value={fmt(creator.avg_comments)} />
            <Stat label="Engagement" value={creator.engagement_rate == null ? "—" : `${creator.engagement_rate.toFixed(2)}%`} />
          </section>

          {/* Authenticity Breakdown Card */}
          <section className="mt-8">
            <AuthenticityCard userId={creator.creator_id} viewer="brand" />
          </section>

          {/* Reviews from Brands */}
          <Reviews data={reviews} />

          {/* Action Footer Button */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-peacock-surface p-6">
            <div>
              <p className="text-sm font-medium text-white">Interested in working with {creator.creator_name || "this creator"}?</p>
              <p className="text-xs text-gray-400 mt-1">Start a conversation or negotiate deal terms directly.</p>
            </div>
            <Link
              href="/dashboard/messages"
              className="inline-flex items-center gap-2 rounded-xl bg-peacock-teal px-5 py-2.5 text-sm font-bold text-peacock-on-teal transition hover:brightness-110 shadow-md"
            >
              <MessageCircle className="h-4 w-4" /> Message / Negotiate
            </Link>
          </div>

          <p className="mt-6 text-xs text-gray-500">
            Contact details are shared once this creator expresses interest in one of your campaigns.
          </p>
        </>
      )}
    </div>
  )
}
