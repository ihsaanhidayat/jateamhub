-- ============================================================
-- Password Vault: recoverable master-key escrow
-- ============================================================
-- Model:
--   · Each user picks a vault master PIN.
--   · PIN → PBKDF2-SHA256 → AES-GCM key (client-side only).
--   · The vault entries are encrypted with that key and ride inside the
--     widget section's items[0].desc (synced via the normal layout sync).
--   · vault_keys stores ONLY the PBKDF2 salt + a small encrypted verifier
--     so the SAME PIN re-derives the SAME key on any device, and a wrong
--     PIN can be detected without ever exposing key material.
--   · Server never sees the PIN or plaintext passwords. Owner-only RLS.

create table if not exists public.vault_keys (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  salt       text not null,   -- PBKDF2 salt (base64)
  iv         text not null,   -- AES-GCM iv for the verifier (base64)
  verifier   text not null,   -- AES-GCM ciphertext of a known token (base64)
  updated_at timestamptz not null default now()
);

alter table public.vault_keys enable row level security;

drop policy if exists vault_keys_select_own on public.vault_keys;
create policy vault_keys_select_own on public.vault_keys
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists vault_keys_insert_own on public.vault_keys;
create policy vault_keys_insert_own on public.vault_keys
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists vault_keys_update_own on public.vault_keys;
create policy vault_keys_update_own on public.vault_keys
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists vault_keys_delete_own on public.vault_keys;
create policy vault_keys_delete_own on public.vault_keys
  for delete to authenticated
  using ((select auth.uid()) = user_id);
