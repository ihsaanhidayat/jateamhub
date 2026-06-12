-- ============================================================
-- Chat: forwarded-message flag
-- ============================================================
alter table public.chat_messages
  add column if not exists is_forwarded boolean not null default false;
