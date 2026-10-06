import {
  BarChart3,
  Clapperboard,
  Handshake,
  Inbox,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserRound,
  WandSparkles,
  type LucideIcon,
} from "lucide-react"

import type { Role } from "./types"

/**
 * Crewaa V3 is split into parts. Each part has a signature colour (see the
 * `part-*` tokens in globals.css) and its own section of the app.
 *
 *   Brands   → Collabs, Crewaa Grow, AI Influencers, AI Marketing Suite
 *   Creators → Collabs, AI Marketing Suite, Crewaa Crew
 *
 * Collabs holds every page that existed before V3. The other parts are
 * "coming soon" pages until their phase ships (VERSION-3-PLAN.md).
 */
export type PartId = "collabs" | "grow" | "ai" | "suite" | "crew"

export interface NavLink {
  href: string
  label: string
  icon: LucideIcon
}

export interface Part {
  id: PartId
  name: string
  /** Where the part's tab takes you. */
  href: string
  /** Paths that belong to this part, used to light up the right tab. */
  prefixes: string[]
  icon: LucideIcon
  /** Tailwind classes built from the part's signature colour. */
  dot: string
  text: string
  soon?: boolean
}

export const PARTS: Record<PartId, Part> = {
  collabs: {
    id: "collabs",
    name: "Collabs",
    href: "",
    prefixes: [],
    icon: Handshake,
    dot: "bg-part-collabs",
    text: "text-part-collabs",
  },
  grow: {
    id: "grow",
    name: "Crewaa Grow",
    href: "/dashboard/grow",
    prefixes: ["/dashboard/grow"],
    icon: TrendingUp,
    dot: "bg-part-grow",
    text: "text-part-grow",
    soon: true,
  },
  ai: {
    id: "ai",
    name: "AI Influencers",
    href: "/dashboard/ai-influencers",
    prefixes: ["/dashboard/ai-influencers"],
    icon: Sparkles,
    dot: "bg-part-ai",
    text: "text-part-ai",
    soon: true,
  },
  suite: {
    id: "suite",
    name: "AI Marketing Suite",
    href: "/dashboard/marketing-suite",
    prefixes: ["/dashboard/marketing-suite"],
    icon: WandSparkles,
    dot: "bg-part-suite",
    text: "text-part-suite",
    soon: true,
  },
  crew: {
    id: "crew",
    name: "Crewaa Crew",
    href: "/dashboard/crew",
    prefixes: ["/dashboard/crew"],
    icon: Clapperboard,
    dot: "bg-part-crew",
    text: "text-part-crew",
    soon: true,
  },
}

/** Which parts each role sees, in tab order. Admins keep their console. */
export const PARTS_FOR_ROLE: Record<Role, PartId[]> = {
  BRAND: ["collabs", "grow", "ai", "suite"],
  INFLUENCER: ["collabs", "suite", "crew"],
  ADMIN: [],
}

/** The pages inside Collabs — every pre-V3 page, unchanged. */
export const COLLABS_LINKS: Record<Role, NavLink[]> = {
  INFLUENCER: [
    { href: "/dashboard/influencer", label: "Studio", icon: LayoutGrid },
    { href: "/dashboard/analytics/influencer", label: "Analytics", icon: BarChart3 },
    { href: "/dashboard/messages", label: "Messages", icon: MessageCircle },
    { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  ],
  BRAND: [
    { href: "/dashboard/brand", label: "Studio", icon: LayoutGrid },
    { href: "/dashboard/brand/campaigns", label: "Campaigns", icon: Megaphone },
    { href: "/dashboard/brand/interested", label: "Responses", icon: Inbox },
    { href: "/dashboard/messages", label: "Messages", icon: MessageCircle },
    { href: "/dashboard/analytics/brand", label: "Dashboard", icon: BarChart3 },
    { href: "/dashboard/brand-profile", label: "Profile", icon: UserRound },
  ],
  ADMIN: [
    { href: "/dashboard/admin", label: "Overview", icon: LayoutGrid },
    { href: "/dashboard/admin/users", label: "Users", icon: UserRound },
    { href: "/dashboard/admin/trust", label: "Trust", icon: ShieldAlert },
    { href: "/dashboard/admin/waitlist", label: "Waitlist", icon: Inbox },
  ],
}

/** The part a path belongs to, for this role. Anything unclaimed is Collabs. */
export function partForPath(role: Role, pathname: string): PartId {
  const match = PARTS_FOR_ROLE[role].find((id) =>
    PARTS[id].prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))
  )
  return match ?? "collabs"
}

/** Part routes a role may open (used by the client-side route guard). */
export function partPrefixesForRole(role: Role): string[] {
  return PARTS_FOR_ROLE[role].flatMap((id) => PARTS[id].prefixes)
}
