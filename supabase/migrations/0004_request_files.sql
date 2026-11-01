-- 0004: files attached to student requests (the source an admin builds a test or subject from).
-- Run in Supabase: SQL Editor -> paste -> Run (after 0003).

-- [{ "path": "<user id>/<file>", "name": "lecture.pdf", "size": 12345, "mime": "application/pdf" }, ...]
alter table public.suggestions
  add column attachments jsonb not null default '[]'
  check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 5);

-- Private bucket: nobody gets a public link; the admin site asks for short-lived signed ones.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-files', 'request-files', false, 20971520, -- 20 MB, the most the bot can download
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/markdown',
    'image/jpeg', 'image/png', 'image/webp'
  ]
)
on conflict (id) do nothing;

-- A student writes only into a folder named after their own id and reads only their own files.
-- Admins read and delete everything. (The bot uses the service role, which skips these rules.)
create policy "request files: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'request-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "request files: read own or admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'request-files' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create policy "request files: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'request-files' and public.is_admin());
