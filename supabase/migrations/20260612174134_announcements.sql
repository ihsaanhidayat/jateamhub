-- ============================================================
-- Governance: announcements (targeted, one-way broadcast)
-- ============================================================
create table if not exists public.announcements (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid references public.profiles(id) on delete set null,
  title         text not null,
  body          text not null,
  target_role   text,   -- null = all roles
  target_region text,   -- null = all regions
  target_unit   text,   -- null = all units
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists idx_announcements_active on public.announcements (is_active, created_at desc);

alter table public.announcements enable row level security;

-- Targeted users see active announcements meant for them.
drop policy if exists ann_select on public.announcements;
create policy ann_select on public.announcements
  for select to authenticated
  using (
    is_active = true and exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid())
        and (announcements.target_role   is null or announcements.target_role   = me.role)
        and (announcements.target_region is null or announcements.target_region = me.region_scope)
        and (announcements.target_unit   is null or announcements.target_unit   = me.unit_scope)
    )
  );

-- Superadmins see everything (incl. inactive / non-targeted) and manage them.
drop policy if exists ann_select_su on public.announcements;
create policy ann_select_su on public.announcements
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'superadmin'));

drop policy if exists ann_insert_su on public.announcements;
create policy ann_insert_su on public.announcements
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'superadmin'));

drop policy if exists ann_update_su on public.announcements;
create policy ann_update_su on public.announcements
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'superadmin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'superadmin'));

drop policy if exists ann_delete_su on public.announcements;
create policy ann_delete_su on public.announcements
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'superadmin'));

-- Live delivery of new announcements.
do $$ begin
  alter publication supabase_realtime add table public.announcements;
exception when duplicate_object then null;
end $$;
