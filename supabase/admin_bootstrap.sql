-- Emergency fallback only. Prefer the grant-admin Edge Function with ADMIN_BOOTSTRAP_TOKEN.
-- Run this in the Supabase SQL editor with a project owner account.
-- Replace the email with the verified operator account that should manage a school.

update public.profiles
set
  is_admin = true,
  account_status = 'active',
  verification_status = 'approved',
  updated_at = now()
where id = (
  select id
  from auth.users
  where email = 'junsu0665@gmail.com'
  limit 1
);

select id, display_name, is_admin, verification_status, account_status
from public.profiles
where is_admin = true;
