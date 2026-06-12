-- ============================================================
-- Chat: reply / quote support
-- ============================================================
-- A message can reference another message in the same conversation.
-- The quoted preview is resolved client-side from the decrypted in-memory
-- messages, so no plaintext snippet is stored (keeps E2EE intact).

alter table public.chat_messages
  add column if not exists reply_to uuid references public.chat_messages(id) on delete set null;

create index if not exists idx_chat_messages_reply_to
  on public.chat_messages (reply_to) where reply_to is not null;
