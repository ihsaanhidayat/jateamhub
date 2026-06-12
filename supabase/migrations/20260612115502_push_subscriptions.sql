-- ============================================================
-- Web Push: device subscriptions (for closed-app notifications)
-- ============================================================
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Owner manages own subscriptions; the Edge Function reads via service role.
drop policy if exists push_sub_select_own on public.push_subscriptions;
create policy push_sub_select_own on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists push_sub_insert_own on public.push_subscriptions;
create policy push_sub_insert_own on public.push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists push_sub_update_own on public.push_subscriptions;
create policy push_sub_update_own on public.push_subscriptions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists push_sub_delete_own on public.push_subscriptions;
create policy push_sub_delete_own on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);
