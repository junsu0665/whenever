create table if not exists public.post_views (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_views enable row level security;

create index if not exists post_views_user_id_idx on public.post_views (user_id);

drop policy if exists "users read own post views" on public.post_views;
create policy "users read own post views" on public.post_views
  for select using (user_id = (select auth.uid()));

drop policy if exists "admins manage post views" on public.post_views;
create policy "admins manage post views" on public.post_views
  for all using (public.is_admin()) with check (public.is_admin());

drop function if exists public.increment_post_view(uuid);

create function public.increment_post_view(target_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := (select auth.uid());
  inserted_count integer := 0;
  next_view_count integer := 0;
begin
  if viewer_id is null then
    raise exception 'not allowed to view post';
  end if;

  if not (
    public.is_admin()
    or exists (
      select 1
      from public.posts
      join public.profiles on profiles.school_id = posts.school_id
      where posts.id = target_post_id
        and posts.hidden = false
        and profiles.id = viewer_id
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
  ) then
    raise exception 'not allowed to view post';
  end if;

  insert into public.post_views (post_id, user_id)
  values (target_post_id, viewer_id)
  on conflict do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count > 0 then
    update public.posts
    set view_count = view_count + 1,
        updated_at = now()
    where id = target_post_id
    returning view_count into next_view_count;
  else
    select view_count
      into next_view_count
      from public.posts
      where id = target_post_id;
  end if;

  return coalesce(next_view_count, 0);
end;
$$;
