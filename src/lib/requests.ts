// Students cannot create subjects or materials. They send requests to the admins instead.
import { supabase } from './supabase';
import { Attachment, attachmentPath, MAX_ATTACHMENTS, MAX_FILE_BYTES, mimeForName } from '../../supabase/functions/_shared/attachments';

export { MAX_ATTACHMENTS, MAX_FILE_BYTES };
export type { Attachment };

export type RequestKind = 'new_subject' | 'questions' | 'bug' | 'other';
export type RequestStatus = 'new' | 'seen' | 'accepted' | 'declined';

export interface MyRequest {
  id: number;
  kind: RequestKind;
  text: string;
  status: RequestStatus;
  admin_reply: string | null;
  attachments: Attachment[];
  created_at: string;
}

export class RequestLimitError extends Error {}
// 'type': not a document or image we accept; 'size': over the limit; 'count': too many; 'upload': it did not go through
export class RequestFileError extends Error {
  constructor(public reason: 'type' | 'size' | 'count' | 'upload', public fileName = '') {
    super(reason);
  }
}

// Files go straight to the private bucket (into a folder named after the sender), then the request names them
export async function sendRequest(kind: RequestKind, text: string, files: File[] = [], userId = ''): Promise<void> {
  if (!supabase) throw new Error('offline');
  if (files.length > MAX_ATTACHMENTS) throw new RequestFileError('count');

  const attachments: Attachment[] = [];
  for (const file of files) {
    const mime = mimeForName(file.name);
    if (!mime) throw new RequestFileError('type', file.name);
    if (file.size > MAX_FILE_BYTES) throw new RequestFileError('size', file.name);
    const path = attachmentPath(userId, file.name, Date.now() + attachments.length);
    const { error: uploadError } = await supabase.storage.from('request-files').upload(path, file, { contentType: mime });
    if (uploadError) throw new RequestFileError('upload', file.name);
    attachments.push({ path, name: file.name, size: file.size, mime });
  }

  const { error } = await supabase.functions.invoke('request-admin', { body: { kind, text, attachments } });
  if (error) {
    if ((error as { context?: Response }).context?.status === 429) throw new RequestLimitError();
    throw error;
  }
}

export async function fetchMyRequests(): Promise<MyRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('suggestions')
    .select('id, kind, text, status, admin_reply, attachments, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as MyRequest[];
}
