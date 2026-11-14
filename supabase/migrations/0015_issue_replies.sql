-- An admin can answer a student's "this question has a mistake" report; the answer is sent to the student in the bot
-- (admin-reply function) and kept here.
alter table public.issue_reports add column if not exists admin_reply text check (char_length(admin_reply) <= 2000);
alter table public.issue_reports add column if not exists replied_at timestamptz;
