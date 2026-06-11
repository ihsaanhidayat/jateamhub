-- ============================================================
-- Chat: WhatsApp-style delivery/read status + presence
-- ============================================================
-- RLS note: existing policies already cover the new writes —
--   · chat_messages.msg_update  → participants may UPDATE messages
--     (delivered_at / read_at / reactions), so no new policy needed.
--   · profiles.profiles_update_self → owner may UPDATE own row
--     (last_seen), so no new policy needed.

-- ── chat_messages: delivery + read timestamps, reactions ──────
alter table public.chat_messages
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at      timestamptz,
  add column if not exists reactions    jsonb not null default '{}'::jsonb;

-- Backfill: messages already flagged read get a read_at so old
-- threads show the double-blue check instead of "pending".
update public.chat_messages
  set read_at = coalesce(read_at, created_at)
  where is_read = true and read_at is null;

-- Index to speed up "mark delivered/read" sweeps per conversation.
create index if not exists idx_chat_messages_conv_status
  on public.chat_messages (conversation_id, sender_id)
  where deleted_at is null;

-- ── profiles: presence (online / last seen) ──────────────────
alter table public.profiles
  add column if not exists last_seen timestamptz;
