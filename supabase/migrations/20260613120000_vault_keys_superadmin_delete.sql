-- ============================================================
-- Allow a superadmin to wipe (delete) any user's vault_keys row.
-- This is the server side of "Reset Brankas" in user management.
-- The vault stays zero-knowledge: a superadmin can WIPE but never DECRYPT
-- (entries are encrypted with the user's PIN, which is never stored).
-- ============================================================

drop policy if exists vault_keys_superadmin_delete on public.vault_keys;
create policy vault_keys_superadmin_delete on public.vault_keys
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'superadmin'
    )
  );
