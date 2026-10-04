"use client"

/**
 * The notification bell (V2 §2.1).
 *
 * Until this existed, Crewaa had four features whose value depends entirely on
 * the other person responding — messaging, offers, delivery, reviews — and no
 * way to learn that any of them had. People found out by logging in and
 * checking.
 *
 * Polling, not websockets. A socket is the right answer for a live chat and the
 * wrong one for a bell: it needs a connection per open tab held across a free
 * tier that sleeps, to deliver something nobody expects within the second. A
 * count on a timer is a single cheap query and degrades to "slightly late"
 * rather than "silently disconnected".
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  Bell, CheckCheck, Handshake, MessageCircle, PackageCheck, Star,
} from "lucide-react"

import {
  AppNotification, NotificationKind, listNotifications,
  markAllNotificationsRead, markNotificationRead, unreadNotificationCount,
} from "@/lib/notifications"

//: Slow enough to be nearly free, quick enough that a reply during a live
//: negotiation shows up while the conversation is still happening.
const POLL_MS = 45_000

const ICONS: Record<NotificationKind, typeof Bell> = {
  message: MessageCircle,
  offer: Handshake,
  delivery: PackageCheck,
  review: Star,
}

function relativeTime(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const refreshCount = useCallback(async () => {
    try {
      setUnread(await unreadNotificationCount())
    } catch {
      // A failed poll is not worth a toast. The next tick retries, and a
      // transient 401 is already being handled by the axios interceptor.
    }
  }, [])

  useEffect(() => {
    refreshCount()
    const timer = setInterval(refreshCount, POLL_MS)
    return () => clearInterval(timer)
  }, [refreshCount])

  // Close on an outside click or Escape. Without this the panel stays open
  // behind whatever the user clicks next.
  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  async function toggle() {
    if (open) {
      setOpen(false)
      return
    }

    setOpen(true)
    setLoading(true)
    try {
      const fetched = await listNotifications()
      setItems(fetched)

      // Marked read on open, but the list keeps the unread styling it was
      // fetched with — clearing the badge and the highlight at the same instant
      // means the thing you opened the panel to find is no longer marked.
      if (fetched.some((n) => !n.read)) {
        await markAllNotificationsRead()
        setUnread(0)
      }
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  async function openNotification(notification: AppNotification) {
    setOpen(false)
    if (!notification.read) {
      try {
        setUnread(await markNotificationRead(notification.id))
      } catch {
        // Navigating matters more than the read receipt.
      }
    }
    router.push(notification.link)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        className="relative flex items-center rounded-lg px-3 py-2 text-gray-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-semibold text-white"
            // The badge already carries the count in the button's aria-label,
            // so repeating it here would make a screen reader say it twice.
            aria-hidden="true"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-white/10 bg-[#0B0D17] shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-medium text-white">Notifications</span>
              {items.some((n) => !n.read) && (
                <CheckCheck className="h-3.5 w-3.5 text-gray-500" />
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading && (
                <p className="px-4 py-6 text-center text-sm text-gray-500">
                  Loading…
                </p>
              )}

              {!loading && items.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-gray-500">
                  Nothing yet. New messages, offers and deliveries show up here.
                </p>
              )}

              {!loading &&
                items.map((notification) => {
                  const Icon = ICONS[notification.kind] ?? Bell
                  return (
                    <button
                      key={notification.id}
                      onClick={() => openNotification(notification)}
                      className={`flex w-full gap-3 border-b border-white/5 px-4 py-3 text-left transition last:border-b-0 hover:bg-white/5 ${
                        notification.read ? "" : "bg-indigo-500/[0.07]"
                      }`}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-white">
                          {notification.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-gray-400">
                          {notification.body}
                        </span>
                        <span className="mt-1 block text-[11px] text-gray-600">
                          {relativeTime(notification.created_at)}
                        </span>
                      </span>
                    </button>
                  )
                })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
