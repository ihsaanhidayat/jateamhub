-- ============================================================
-- Security hardening (advisor findings)
-- ============================================================

-- 1. chat_messages: remove the redundant, overly-permissive UPDATE policy.
--    `msg_clear` had WITH CHECK (true). `msg_update` already lets a
--    conversation participant UPDATE its messages (covers clear/edit/react/
--    read), so clearing keeps working without the permissive policy.
drop policy if exists msg_clear on public.chat_messages;

-- 2. handle_new_user(): it's an auth trigger function, not a public API.
--    Revoke EXECUTE so it can't be invoked via /rest/v1/rpc by anon/authenticated.
--    (Triggers still fire — they don't depend on the role's EXECUTE grant.)
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

-- 3. Public buckets don't need a broad SELECT policy on storage.objects.
--    Removing it prevents clients from enumerating (listing) every file.
--    Public object URLs (getPublicUrl) still serve — the app only uploads +
--    references by URL, never .list()/.download() via the API.
drop policy if exists avatar_read_public on storage.objects;
drop policy if exists chat_files_select  on storage.objects;
