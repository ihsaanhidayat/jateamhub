-- ============================================================
-- Chat: recoverable end-to-end encryption keys
-- ============================================================
-- Model:
--   · Each user has an ECDH P-256 keypair.
--   · Public key → profiles.chat_public_key (partners read it to derive
--     the shared conversation key). Public by design.
--   · Private key → wrapped with the user's chat PIN (PBKDF2 + AES-GCM)
--     and stored in chat_keys (owner-only RLS). Server never sees plaintext
--     key material; recoverable on any device by entering the PIN.
--   · Messages are encrypted client-side with the per-conversation key;
--     chat_messages.is_encrypted flags ciphertext rows.

-- Public key lives on the profile (readable by chat partners).
alter table public.profiles
  add column if not exists chat_public_key text;

-- Per-message encryption flag.
alter table public.chat_messages
  add column if not exists is_encrypted boolean not null default false;

-- Owner-only escrow of the PIN-wrapped private key.
create table if not exists public.chat_keys (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  privkey_enc text not null,   -- AES-GCM ciphertext of the private JWK
  salt        text not null,   -- PBKDF2 salt (base64)
  iv          text not null,   -- AES-GCM iv (base64)
  updated_at  timestamptz not null default now()
);

alter table public.chat_keys enable row level security;

drop policy if exists chat_keys_select_own on public.chat_keys;
create policy chat_keys_select_own on public.chat_keys
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists chat_keys_insert_own on public.chat_keys;
create policy chat_keys_insert_own on public.chat_keys
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists chat_keys_update_own on public.chat_keys;
create policy chat_keys_update_own on public.chat_keys
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
