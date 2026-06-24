create table if not exists public.account_phone_numbers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_number text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_phone_numbers_phone_number_format
    check (phone_number ~ '^\+8210[0-9]{8}$')
);

create unique index if not exists account_phone_numbers_phone_number_key
  on public.account_phone_numbers (phone_number);

alter table public.account_phone_numbers enable row level security;

create policy "users insert own phone claim"
  on public.account_phone_numbers for insert
  with check (user_id = (select auth.uid()));

create policy "users read own phone claim"
  on public.account_phone_numbers for select
  using (user_id = (select auth.uid()));

create policy "users delete own phone claim"
  on public.account_phone_numbers for delete
  using (user_id = (select auth.uid()));

create policy "admins read phone claims"
  on public.account_phone_numbers for select
  using (public.is_admin());

create or replace function public.is_phone_number_available(p_phone_number text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_phone_number ~ '^\+8210[0-9]{8}$'
    and not exists (
      select 1
      from public.account_phone_numbers
      where phone_number = p_phone_number
    );
$$;

grant execute on function public.is_phone_number_available(text) to anon, authenticated;
