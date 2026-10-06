"use client"

/**
 * A creator's profile as a brand sees it (V3 Phase 3) — the page behind
 * "View complete profile". Public stats plus the full Authenticity report.
 * No contact details: those are shared only when the creator expresses interest.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, BadgeCheck, ExternalLink, Instagram, Loader2, MapPin, Star, Youtube } from "lucide-react"

import { getCreatorForBrand, type CreatorProfileForBrand } from "@/lib/ai"
import { getPublicReviews, type PublicReviews } from "@/lib/deal-terms"
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

  return (
    <div className="mx-auto max-w-5xl py-4">
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
          <header className="mt-8 flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="text-sm text-peacock-teal">{[creator.category, creator.primary_platform].filter(Boolean).join(" · ") || "Creator"}</p>
              <h1 className="mt-2 flex items-center gap-3 font-display text-4xl font-medium text-white md:text-5xl">
                {creator.creator_name || "Unnamed creator"}
                {creator.is_verified && <BadgeCheck className="h-7 w-7 text-peacock-blue" aria-label="Verified on platform" />}
              </h1>
              {creator.location && (
                <p className="mt-3 inline-flex items-center gap-2 text-sm text-gray-400">
                  <MapPin className="h-4 w-4" aria-hidden /> {creator.location}
                </p>
              )}
              <div className="mt-4"><AuthenticityBadge summary={creator.authenticity} showReason /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {creator.instagram_url && (
                <a href={creator.instagram_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-peacock-surface px-4 py-2.5 text-sm text-white transition hover:border-white/20">
                  <Instagram className="h-4 w-4" aria-hidden /> @{creator.instagram_username} <ExternalLink className="h-3.5 w-3.5 text-gray-500" aria-hidden />
                </a>
              )}
              {creator.youtube_url && (
                <a href={creator.youtube_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-peacock-surface px-4 py-2.5 text-sm text-white transition hover:border-white/20">
                  <Youtube className="h-4 w-4" aria-hidden /> {creator.youtube_username || "YouTube"} <ExternalLink className="h-3.5 w-3.5 text-gray-500" aria-hidden />
                </a>
              )}
            </div>
          </header>

          {creator.bio && <p className="mt-8 max-w-3xl leading-relaxed text-gray-300">{creator.bio}</p>}

          <section className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {creator.subscribers != null && creator.followers == null
              ? <Stat label="Subscribers" value={fmt(creator.subscribers)} />
              : <Stat label="Followers" value={fmt(creator.followers)} />}
            <Stat label="Avg likes" value={fmt(creator.avg_likes)} />
            <Stat label="Avg comments" value={fmt(creator.avg_comments)} />
            <Stat label="Engagement" value={creator.engagement_rate == null ? "—" : `${creator.engagement_rate.toFixed(2)}%`} />
          </section>

          <section className="mt-10">
            <AuthenticityCard userId={creator.creator_id} viewer="brand" />
          </section>

          <Reviews data={reviews} />

          <p className="mt-8 text-xs text-gray-500">
            Contact details are shared once this creator expresses interest in one of your campaigns.
          </p>
        </>
      )}
    </div>
  )
}
