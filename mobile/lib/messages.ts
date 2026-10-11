import { api } from './api';
import { MessageOut, ThreadDetail, ThreadSummary } from '../types';

export async function listThreads(): Promise<ThreadSummary[]> {
  const res = await api.get<ThreadSummary[]>('/messages/threads');
  return res.data;
}

export async function getThread(interestId: number): Promise<ThreadDetail> {
  const res = await api.get<ThreadDetail>(`/messages/threads/${interestId}`);
  return res.data;
}

export async function sendMessage(interestId: number, body: string): Promise<MessageOut> {
  const res = await api.post<MessageOut>(`/messages/threads/${interestId}`, { body });
  return res.data;
}

export async function markRead(interestId: number): Promise<void> {
  await api.post(`/messages/threads/${interestId}/read`);
}

export async function startThread(
  creatorId: number,
  message?: string,
  campaignId?: number
): Promise<ThreadDetail> {
  const res = await api.post<ThreadDetail>('/messages/start', {
    creator_id: creatorId,
    message: message?.trim() || undefined,
    campaign_id: campaignId,
  });
  return res.data;
}

export async function getThreadByCreator(creatorId: number): Promise<{ interest_id: number | null }> {
  const res = await api.get<{ interest_id: number | null }>(`/messages/threads/by-creator/${creatorId}`);
  return res.data;
}
