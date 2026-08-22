import { api } from "./axios"

export interface Counterpart {
  user_id: number
  name: string
  subtitle?: string
  location?: string
}

export interface MessageOut {
  id: number
  sender_id: number
  body: string
  created_at: string
  read_at?: string
  is_mine: boolean
}

export interface ThreadSummary {
  interest_id: number
  counterpart: Counterpart
  last_message?: string
  last_message_at?: string
  unread_count: number
  interest_status: string
}

export interface ThreadDetail {
  interest_id: number
  counterpart: Counterpart
  interest_status: string
  messages: MessageOut[]
}

export async function listThreads(): Promise<ThreadSummary[]> {
  const res = await api.get("/messages/threads")
  return res.data
}

export async function getThread(interestId: number): Promise<ThreadDetail> {
  const res = await api.get(`/messages/threads/${interestId}`)
  return res.data
}

export async function sendMessage(interestId: number, body: string): Promise<MessageOut> {
  const res = await api.post(`/messages/threads/${interestId}`, { body })
  return res.data
}

export async function markRead(interestId: number): Promise<void> {
  await api.post(`/messages/threads/${interestId}/read`)
}

export async function getUnreadCount(): Promise<number> {
  const res = await api.get("/messages/unread-count")
  return res.data.unread_count
}
