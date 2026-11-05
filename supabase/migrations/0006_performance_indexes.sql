-- Indexes for high-frequency queries and foreign key lookups

-- Profiles lookup by role and activity
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc);

-- Library items filtering by kind, publication and updates
create index if not exists library_items_kind_published_idx on public.library_items (kind, published);
create index if not exists library_items_updated_idx on public.library_items (updated_at desc);

-- Community membership lookup by user
create index if not exists community_members_user_idx on public.community_members (user_id);

-- Assignments due date, status and referenced library item
create index if not exists assignments_due_idx on public.assignments (due_at);
create index if not exists assignments_status_idx on public.assignments (status);
create index if not exists assignments_library_item_idx on public.assignments (library_item_id);

-- Assignment progress lookup by user
create index if not exists assignment_progress_user_idx on public.assignment_progress (user_id);

-- Student suggestions and issue reports
create index if not exists suggestions_user_idx on public.suggestions (user_id);
create index if not exists issue_reports_item_idx on public.issue_reports (library_item_id);
create index if not exists issue_reports_status_idx on public.issue_reports (status);
