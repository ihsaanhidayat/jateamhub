-- ============================================================
-- Chat: latest message per conversation (for sidebar previews)
-- ============================================================
-- SECURITY INVOKER → RLS on chat_messages applies, so a caller only ever
-- gets the last message of conversations they participate in. The (possibly
-- encrypted) content is decrypted client-side for the preview.

create or replace function public.chat_last_messages()
returns setof public.chat_messages
language sql
security invoker
stable
set search_path = public
as $$
  select distinct on (conversation_id) *
  from public.chat_messages
  where deleted_at is null
  order by conversation_id, created_at desc
$$;
