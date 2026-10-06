"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { HOME_FOR_ROLE, useSession } from "@/lib/session";
import { PARTS, type PartId } from "@/lib/parts";

/**
 * Placeholder for a part that has not launched yet (VERSION-3-PLAN.md).
 * Grow and the Marketing Suite are deliberately just "coming soon" — no
 * notify-me (decision 16). AI Influencers passes `children` for its waitlist
 * (decision 12).
 */
export function ComingSoon({
  part,
  title,
  description,
  points,
  children,
}: {
  part: PartId;
  title: string;
  description: string;
  points: string[];
  children?: React.ReactNode;
}) {
  const { user } = useSession();
  const reduce = useReducedMotion();
  const p = PARTS[part];
  const Icon = p.icon;

  return (
    <section className="relative mx-auto flex min-h-[calc(100vh-var(--app-header,4rem))] max-w-6xl items-center overflow-hidden px-6 py-16">
      {/* the Crewaa mark, slowly turning, in the background */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-1/2 h-[560px] w-[560px] -translate-y-1/2 opacity-[0.07] md:-right-24"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 90, ease: "linear", repeat: Infinity }}
      >
        <Image src="/crewaa-mark.svg" alt="" fill unoptimized />
      </motion.div>

      <div
        aria-hidden
        className={`pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full ${p.dot} opacity-[0.08] blur-3xl`}
      />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative max-w-2xl"
      >
        <div className={`mb-8 flex items-center gap-3 text-sm font-medium ${p.text}`}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-current/30 bg-current/10">
            <Icon className="h-4 w-4" />
          </span>
          {p.name}
          <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-gray-400">Coming soon</span>
        </div>

        <h1 className="font-display text-5xl font-medium leading-[1.04] text-white md:text-7xl">{title}</h1>
        <p className="mt-6 max-w-xl text-lg text-gray-400">{description}</p>

        <ul className="mt-10 border-t border-white/10">
          {points.map((point) => (
            <li key={point} className="flex items-baseline gap-4 border-b border-white/10 py-4 text-gray-200">
              <span className={`h-1.5 w-1.5 shrink-0 -translate-y-0.5 rounded-full ${p.dot}`} />
              {point}
            </li>
          ))}
        </ul>

        {children}

        {user && (
          <Link
            href={HOME_FOR_ROLE[user.role]}
            className="mt-10 flex w-fit items-center gap-3 text-sm font-medium text-peacock-teal transition hover:gap-4"
          >
            Back to Collabs
            <span className="h-px w-6 bg-current" />
          </Link>
        )}
      </motion.div>
    </section>
  );
}
