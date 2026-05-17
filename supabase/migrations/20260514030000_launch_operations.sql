alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists student_id_policy_accepted_at timestamptz;

alter table public.timetables
  add column if not exists semester_label text not null default '2026 1학기';

create index if not exists notification_settings_push_token_idx
  on public.notification_settings (push_token)
  where push_token is not null;

create table if not exists public.post_bookmarks (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_bookmarks enable row level security;

create index if not exists post_bookmarks_user_id_idx on public.post_bookmarks (user_id);

create policy "users read own post bookmarks" on public.post_bookmarks
  for select using (user_id = (select auth.uid()));

create policy "verified users create post bookmarks" on public.post_bookmarks
  for insert with check (
    user_id = (select auth.uid())
    and public.is_verified_user()
    and exists (
      select 1
      from public.posts
      join public.profiles on profiles.school_id = posts.school_id
      where posts.id = post_bookmarks.post_id
        and posts.hidden = false
        and profiles.id = (select auth.uid())
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
  );

create policy "users delete own post bookmarks" on public.post_bookmarks
  for delete using (user_id = (select auth.uid()));

create policy "admins manage post bookmarks" on public.post_bookmarks
  for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.analytics_events enable row level security;

create index if not exists analytics_events_event_name_created_at_idx
  on public.analytics_events (event_name, created_at desc);

create index if not exists analytics_events_user_id_created_at_idx
  on public.analytics_events (user_id, created_at desc)
  where user_id is not null;

create policy "users create own analytics events" on public.analytics_events
  for insert with check (user_id is null or user_id = (select auth.uid()));

create policy "admins read analytics events" on public.analytics_events
  for select using (public.is_admin());

create policy "verified users cache own school meal menus" on public.meal_menus
  for insert with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.school_id = meal_menus.school_id
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
  );

create policy "verified users refresh own school meal menus" on public.meal_menus
  for update using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.school_id = meal_menus.school_id
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.school_id = meal_menus.school_id
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
  );
