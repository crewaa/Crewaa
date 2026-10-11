"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  ExternalLink,
  Inbox,
  Instagram,
  Loader2,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Tag,
  User,
  Youtube,
} from "lucide-react"

import {
  getInterestedCreators,
  type CampaignSummary,
  type InterestedCreator,
} from "@/lib/ai"
import { getSafeImageUrl } from "@/lib/images"
import { errorMessage } from "@/lib/types"
import { AuthenticityBadge } from "@/components/dashboard/authenticity-badge"

function compact(n?: number | null): string {
  if (n === undefined || n === null) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function InterestedCreatorsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCampaignId = searchParams.get("campaign_id")
    ? Number(searchParams.get("campaign_id"))
    : undefined

  const [selectedCampaignId, setSelectedCampaignId] = useState<number | undefined>(initialCampaignId)
  const [creators, setCreators] = useState<InterestedCreator[]>([])
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Keep state in sync if URL query parameter changes
  useEffect(() => {
    const param = searchParams.get("campaign_id")
    setSelectedCampaignId(param ? Number(param) : undefined)
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")

    getInterestedCreators(selectedCampaignId)
      .then((data) => {
        if (!cancelled) {
          setCreators(data.creators || [])
          setCampaigns(data.campaigns || [])
          setTotal(data.total || 0)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "We couldn't load interested creators."))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedCampaignId])

  function handleSelectCampaign(id?: number) {
    setSelectedCampaignId(id)
    if (id) {
      router.push(`/dashboard/brand/interested?campaign_id=${id}`, { scroll: false })
    } else {
      router.push(`/dashboard/brand/interested`, { scroll: false })
    }
  }

  const totalAllCampaigns = campaigns.reduce((acc, c) => acc + c.count, 0)
  const activeCampaignObj = campaigns.find((c) => c.id === selectedCampaignId)

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-[-20%] left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-[160px]" />
        <div className="absolute bottom-[-30%] right-[15%] h-[400px] w-[400px] rounded-full bg-indigo-500/10 blur-[140px]" />
      </div>

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <button
              onClick={() => router.back()}
              className="mb-4 inline-flex items-center gap-2 text-sm text-gray-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </button>
            <h1 className="font-display text-4xl font-medium text-white md:text-5xl">
              Interested Creators
            </h1>
            <p className="mt-2 text-gray-400">
              Creators who have expressed interest in collaborating with your brand.
            </p>
          </div>
        </div>

        {/* Campaign Filter Tabs / Bifurcation Bar */}
        {campaigns.length > 0 && (
          <div className="mb-8">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
              Filter by Campaign
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectCampaign(undefined)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition cursor-pointer ${
                  selectedCampaignId === undefined
                    ? "bg-peacock-teal text-peacock-on-teal shadow-md"
                    : "border border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <span>All Campaigns</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    selectedCampaignId === undefined
                      ? "bg-black/20 text-peacock-on-teal"
                      : "bg-white/10 text-gray-300"
                  }`}
                >
                  {totalAllCampaigns}
                </span>
              </button>

              {campaigns.map((camp) => {
                const isActive = selectedCampaignId === camp.id
                return (
                  <button
                    key={camp.id}
                    type="button"
                    onClick={() => handleSelectCampaign(camp.id)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition cursor-pointer ${
                      isActive
                        ? "bg-peacock-teal text-peacock-on-teal shadow-md"
                        : "border border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <span className="max-w-[220px] truncate">{camp.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isActive
                          ? "bg-black/20 text-peacock-on-teal"
                          : "bg-white/10 text-gray-300"
                      }`}
                    >
                      {camp.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-center text-red-400">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading responses…
          </div>
        )}

        {!loading && creators.length === 0 && !error && (
          <div className="rounded-2xl border border-white/10 bg-peacock-surface p-12 text-center">
            <Inbox className="mx-auto mb-4 h-10 w-10 text-gray-600" aria-hidden="true" />
            <p className="text-xl text-gray-400">
              {activeCampaignObj
                ? `No responses yet for "${activeCampaignObj.name}"`
                : "No responses yet"}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              {activeCampaignObj ? (
                <button
                  onClick={() => handleSelectCampaign(undefined)}
                  className="text-peacock-teal hover:underline cursor-pointer"
                >
                  View all responses across all campaigns →
                </button>
              ) : (
                "Creators who are interested in your opportunities will appear here with their contact details."
              )}
            </p>
          </div>
        )}

        {!loading && creators.length > 0 && (
          <div className="space-y-4">
            {creators.map((c) => (
              <div
                key={c.interest_id}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-peacock-surface to-peacock-deep p-6 transition hover:border-white/20 shadow-md"
              >
                {/* Identity Header with Profile Picture */}
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {c.profile_picture || c.avatar_url ? (
                        <img
                          src={getSafeImageUrl((c.profile_picture || c.avatar_url)!)}
                          alt={c.creator_name || "Creator"}
                          referrerPolicy="no-referrer"
                          className="h-12 w-12 rounded-full object-cover border-2 border-peacock-teal/60 bg-peacock-surface"
                          onError={(e) => {
                            const target = e.currentTarget
                            target.style.display = "none"
                            const fallback = target.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = "flex"
                          }}
                        />
                      ) : null}
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-full border-2 border-peacock-teal/60 bg-peacock-surface text-peacock-teal ${
                          c.profile_picture || c.avatar_url ? "hidden" : "flex"
                        }`}
                      >
                        <User className="h-6 w-6" />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-xl font-semibold text-white">
                        {c.creator_name || "Creator"}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
                        {c.category && (
                          <span className="flex items-center gap-1">
                            <Tag className="h-3.5 w-3.5" /> {c.category}
                          </span>
                        )}
                        {c.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-peacock-teal" /> {c.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Campaign bifurcation badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    {c.campaign_name && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-peacock-teal/40 bg-peacock-teal/15 px-3 py-1 text-xs font-medium text-peacock-teal">
                        <Megaphone className="h-3 w-3" />
                        <span className="max-w-[180px] sm:max-w-[260px] truncate">
                          {c.campaign_name}
                        </span>
                      </span>
                    )}
                    {c.campaign_type && (
                      <span className="shrink-0 rounded-full border border-indigo-500/30 bg-indigo-500/15 px-3 py-1 text-xs text-indigo-300">
                        {c.campaign_type}
                      </span>
                    )}
                  </div>
                </div>

                {c.authenticity && (
                  <div className="mb-4">
                    <AuthenticityBadge summary={c.authenticity} showReason />
                  </div>
                )}

                <div className="mb-4 flex flex-wrap gap-6 text-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Followers</p>
                    <p className="mt-0.5 font-medium text-white">{compact(c.followers)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Engagement</p>
                    <p className="mt-0.5 font-medium text-white">
                      {c.engagement_rate != null ? `${c.engagement_rate}%` : "—"}
                    </p>
                  </div>
                </div>

                {c.message && (
                  <blockquote className="mb-4 border-l-2 border-white/15 pl-4 text-sm italic text-gray-300">
                    “{c.message}”
                  </blockquote>
                )}

                {/* Handles & Actions (Direct Links & Action Buttons) */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                  {c.instagram_username && (
                    <a
                      href={`https://instagram.com/${c.instagram_username.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-pink-500/30 bg-pink-500/10 px-3 py-1.5 text-sm text-pink-300 transition hover:bg-pink-500/20 hover:text-white"
                    >
                      <Instagram className="h-3.5 w-3.5 text-pink-400" /> @{c.instagram_username.replace(/^@/, "")}
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  )}
                  {c.youtube_username && (
                    <a
                      href={`https://youtube.com/@${c.youtube_username.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-300 transition hover:bg-red-500/20 hover:text-white"
                    >
                      <Youtube className="h-3.5 w-3.5 text-red-400" /> {c.youtube_username}
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  )}
                  <a
                    href={`mailto:${c.email}`}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:border-white/20 hover:text-white"
                  >
                    <Mail className="h-3.5 w-3.5 text-peacock-teal" /> {c.email}
                  </a>

                  <div className="ml-auto flex items-center gap-2">
                    <Link
                      href={`/dashboard/brand/creators/${c.creator_id}`}
                      className="flex items-center gap-1.5 rounded-lg border border-peacock-teal/40 bg-peacock-teal/10 px-3.5 py-1.5 text-sm font-medium text-peacock-teal transition hover:bg-peacock-teal hover:text-peacock-on-teal"
                    >
                      Full profile →
                    </Link>
                    <Link
                      href="/dashboard/messages"
                      className="flex items-center gap-1.5 rounded-lg bg-peacock-teal px-3.5 py-1.5 text-sm font-medium text-peacock-on-teal transition hover:brightness-110"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Message
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default function InterestedCreatorsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-gray-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading responses…
        </div>
      }
    >
      <InterestedCreatorsContent />
    </Suspense>
  )
}
