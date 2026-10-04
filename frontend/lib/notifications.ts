import { api } from "./axios"

export type NotificationKind = "message" | "offer" | "delivery" | "review"

export interface AppNotification {
  id: number
  kind: NotificationKind
  title: string
  body: string
  link: string
  created_at: string
  read: boolean
}

export async function listNotifications(): Promise<AppNotification[]> {
  const res = await api.get("/notifications")
  return res.data
}

export async function unreadNotificationCount(): Promise<number> {
  const res = await api.get("/notifications/unread-count")
  return res.data.unread
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/notifications/read")
}

export async function markNotificationRead(id: number): Promise<number> {
  const res = await api.post(`/notifications/${id}/read`)
  return res.data.unread
}
