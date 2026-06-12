-- ============================================================
-- Chat: message edit support
-- ============================================================
-- Editing reuses the existing msg_update RLS policy (participants may update
-- their conversation's messages). The app restricts edits to your own text
-- messages within a short window.

alter table public.chat_messages
  add column if not exists edited_at timestamptz;
