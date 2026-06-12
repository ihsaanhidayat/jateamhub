-- ============================================================
-- Governance: audit log (superadmin-only)
-- ============================================================
-- Written ONLY by the audit-log Edge Function (service role) so entries
-- can't be forged from the client. Readable by superadmins only.

create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.profiles(id) on delete set null,
  actor_name   text,
  action       text not null,          -- e.g. user.create, role.change, chat.toggle, auth.login
  target_type  text,                   -- user | config | announcement | ...
  target_id    text,
  target_label text,                   -- human-readable target
  metadata     jsonb not null default '{}',
  ip           text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_audit_logs_created on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_action  on public.audit_logs (action);

alter table public.audit_logs enable row level security;

-- Superadmins can read the log. No INSERT/UPDATE/DELETE policy → clients can't
-- write or tamper; only the service-role Edge Function inserts.
drop policy if exists audit_select_superadmin on public.audit_logs;
create policy audit_select_superadmin on public.audit_logs
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'superadmin'
  ));
