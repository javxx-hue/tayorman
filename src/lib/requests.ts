// Students cannot create subjects or materials. They send requests to the admins instead.
import { supabase } from './supabase';

export type RequestKind = 'new_subject' | 'questions' | 'bug' | 'other';
export type RequestStatus = 'new' | 'seen' | 'accepted' | 'declined';

export interface MyRequest {
  id: number;
  kind: RequestKind;
  text: string;
  status: RequestStatus;
  admin_reply: string | null;
  created_at: string;
}

export class RequestLimitError extends Error {}

export async function sendRequest(kind: RequestKind, text: string): Promise<void> {
  if (!supabase) throw new Error('offline');
  const { error } = await supabase.functions.invoke('request-admin', { body: { kind, text } });
  if (error) {
    if ((error as { context?: Response }).context?.status === 429) throw new RequestLimitError();
    throw error;
  }
}

export async function fetchMyRequests(): Promise<MyRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('suggestions')
    .select('id, kind, text, status, admin_reply, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as MyRequest[];
}
