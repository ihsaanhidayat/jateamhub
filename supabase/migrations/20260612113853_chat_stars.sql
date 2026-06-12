-- ============================================================
-- Chat: starred (bookmarked) messages — per user
-- ============================================================
create table if not exists public.chat_stars (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

alter table public.chat_stars enable row level security;

drop policy if exists chat_stars_select_own on public.chat_stars;
create policy chat_stars_select_own on public.chat_stars
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists chat_stars_insert_own on public.chat_stars;
create policy chat_stars_insert_own on public.chat_stars
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists chat_stars_delete_own on public.chat_stars;
create policy chat_stars_delete_own on public.chat_stars
  for delete to authenticated using ((select auth.uid()) = user_id);
