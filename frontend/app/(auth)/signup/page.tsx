"use client"

import { motion, useReducedMotion } from "framer-motion"
import Link from "next/link"
import { ArrowRight, Building2, Sparkles } from "lucide-react"

import { AuthBrand } from "@/components/auth/auth-brand"

/**
 * Choose a side. The two cards name the parts each side gets, so the V3 split
 * (lib/parts.ts) is visible from the first screen.
 */
const roles = [
  {
    title: "I'm a brand",
    description: "Find creators who fit, run campaigns, and grow your business.",
    href: "/signup/brand",
    icon: Building2,
    accent: "text-peacock-teal",
    glow: "rgba(38,189,176,0.18)",
    parts: ["Collabs", "Crewaa Grow", "AI Influencers", "AI Marketing Suite"],
  },
  {
    title: "I'm a creator",
    description: "Get discovered by brands, and get help making better content.",
    href: "/signup/influencer",
    icon: Sparkles,
    accent: "text-peacock-gold",
    glow: "rgba(216,180,90,0.16)",
    parts: ["Collabs", "AI Marketing Suite", "Crewaa Crew"],
  },
]

export default function SignupPage() {
  const reduce = useReducedMotion()
  return (
    <main className="flex min-h-screen items-center justify-center bg-peacock-bg bg-[radial-gradient(60%_50%_at_50%_0%,rgba(38,189,176,0.10),transparent_70%)] px-6 py-16">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-3xl"
      >
        <AuthBrand />

        <h1 className="text-center font-display text-4xl font-medium text-white md:text-5xl">Join the crew.</h1>
        <p className="mt-3 text-center text-gray-400">Tell us which side you&apos;re on.</p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {roles.map((role, i) => {
            const Icon = role.icon
            return (
              <motion.div
                key={role.href}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={role.href}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-peacock-surface p-7 transition duration-300 hover:-translate-y-1 hover:border-white/25"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-0 blur-2xl transition duration-500 group-hover:opacity-100"
                    style={{ background: role.glow }}
                  />
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl border border-current/30 bg-current/10 ${role.accent}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h2 className="mt-6 font-display text-2xl text-white">{role.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{role.description}</p>
                  <ul className="mt-6 flex flex-wrap gap-2">
                    {role.parts.map((p) => (
                      <li key={p} className="rounded-full border border-white/10 px-3 py-1 text-xs text-gray-300">{p}</li>
                    ))}
                  </ul>
                  <span className={`mt-8 inline-flex items-center gap-2 text-sm font-medium ${role.accent}`}>
                    Continue <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
                  </span>
                </Link>
              </motion.div>
            )
          })}
        </div>

        <p className="mt-10 text-center text-sm text-gray-400">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-peacock-teal hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </main>
  )
}
