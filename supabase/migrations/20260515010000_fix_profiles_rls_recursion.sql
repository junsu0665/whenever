create or replace function public.can_read_profile(
  target_id uuid,
  target_school_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_id = auth.uid()
    or exists (
      select 1
      from public.profiles viewer
      where viewer.id = auth.uid()
        and viewer.account_status = 'active'
        and (
          viewer.is_admin = true
          or (
            viewer.verification_status = 'approved'
            and viewer.school_id is not distinct from target_school_id
          )
        )
    );
$$;

drop policy if exists "profiles can read verified school peers" on public.profiles;

create policy "profiles can read verified school peers"
  on public.profiles for select
  using (public.can_read_profile(id, school_id));

grant execute on function public.can_read_profile(uuid, uuid) to authenticated;
