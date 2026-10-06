"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

import { fadeSlideUp } from "@/lib/motion";
import { CurrentUser } from "@/lib/types";
import { HOME_FOR_ROLE } from "@/lib/session";
import { COLLABS_LINKS, PARTS, PARTS_FOR_ROLE, partForPath, type NavLink } from "@/lib/parts";
import NotificationBell from "./notification-bell";
import ProfileDropdown from "./profile-dropdown";

/**
 * V3 navigation: two levels.
 *
 *   1. Parts — Collabs, Crewaa Grow, AI Influencers, AI Marketing Suite,
 *      Crewaa Crew — filtered by role (lib/parts.ts). Each carries its
 *      signature colour so people always know which part they are in.
 *   2. Pages inside the current part. Today only Collabs has pages; it holds
 *      every pre-V3 screen. The other parts are single "coming soon" pages.
 *
 * Admins keep a single row: their console is not part of the five parts.
 */
function activeHrefOf(items: NavLink[], pathname: string) {
  // The most specific matching link wins. A plain `startsWith` lit up both
  // "Studio" (/dashboard/brand) and "Campaigns" (/dashboard/brand/campaigns)
  // at once, because the studio's href is a prefix of every page under it.
  return items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peacock-teal/60";

export default function DashboardNavbar({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const partIds = PARTS_FOR_ROLE[user.role] ?? [];
  const currentPart = partForPath(user.role, pathname);
  const links = currentPart === "collabs" ? COLLABS_LINKS[user.role] ?? [] : [];
  const activeHref = activeHrefOf(links, pathname);

  // Full-height screens (the message thread) size themselves against the
  // header. Its height now depends on role and screen width, so publish the
  // real value as --app-header instead of hard-coding 4rem.
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--app-header", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const partTabs = partIds.map((id) => {
    const part = PARTS[id];
    const href = id === "collabs" ? HOME_FOR_ROLE[user.role] : part.href;
    const active = id === currentPart;
    return (
      <Link
        key={id}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`group relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition ${focusRing} ${
          active ? "bg-white/[0.07] text-white" : "text-gray-400 hover:text-white"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${part.dot} ${
            active ? "shadow-[0_0_10px_currentColor]" : "opacity-70 group-hover:opacity-100"
          }`}
        />
        <span className="whitespace-nowrap">{part.name}</span>
        {part.soon && (
          <span className="rounded-full border border-white/10 px-1.5 text-[10px] leading-4 text-gray-400">
            Soon
          </span>
        )}
      </Link>
    );
  });

  return (
    <motion.header
      ref={headerRef}
      variants={fadeSlideUp}
      initial="hidden"
      animate="visible"
      className="sticky top-0 z-50 border-b border-white/10 bg-peacock-bg/85 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
        <button
          onClick={() => router.push(HOME_FOR_ROLE[user.role])}
          aria-label="Go to your dashboard"
          className={`flex shrink-0 items-center rounded-md transition hover:opacity-80 ${focusRing}`}
        >
          {/* `unoptimized` because Next's optimizer rejects SVGs without
              `dangerouslyAllowSVG`, and a vector gains nothing from it. */}
          <Image
            src="/crewaa-logo-dark.svg"
            alt="Crewaa"
            width={108}
            height={32}
            priority
            unoptimized
            className="h-8 w-auto"
          />
        </button>

        {partTabs.length > 0 && (
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Parts of Crewaa">
            {partTabs}
          </nav>
        )}

        {/* Admins have no parts, so their console links sit in the top row. */}
        {user.role === "ADMIN" && <PageLinks links={COLLABS_LINKS.ADMIN} pathname={pathname} />}

        <div className="flex shrink-0 items-center gap-1">
          <NotificationBell />
          <div className="ml-2">
            <ProfileDropdown user={user} />
          </div>
        </div>
      </div>

      {/* Second row: part tabs on small screens, and the current part's pages.
          On desktop it only appears when the part has pages (Collabs). */}
      {partTabs.length > 0 && (
        <div className={`border-t border-white/5 ${links.length === 0 ? "lg:hidden" : ""}`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-1.5 lg:flex-row lg:items-center">
            <nav
              className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 lg:hidden [scrollbar-width:none]"
              aria-label="Parts of Crewaa"
            >
              {partTabs}
            </nav>
            {links.length > 0 && <PageLinks links={links} pathname={pathname} activeHref={activeHref} />}
          </div>
        </div>
      )}
    </motion.header>
  );
}

function PageLinks({
  links,
  pathname,
  activeHref,
}: {
  links: NavLink[];
  pathname: string;
  activeHref?: string;
}) {
  const active = activeHref ?? activeHrefOf(links, pathname);
  return (
    <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none]" aria-label="Pages">
      {links.map(({ href, label, icon: Icon }) => {
        const isActive = href === active;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${focusRing} ${
              isActive ? "text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className={`h-4 w-4 ${isActive ? "text-peacock-teal" : ""}`} />
            <span>{label}</span>
            {isActive && (
              <motion.span
                layoutId="page-underline"
                className="absolute inset-x-3 -bottom-1.5 h-0.5 rounded-full bg-peacock-teal"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
