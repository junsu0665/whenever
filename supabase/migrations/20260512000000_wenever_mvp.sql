create type public.verification_status as enum ('pending', 'approved', 'rejected');
create type public.account_status as enum ('active', 'suspended');
create type public.friend_status as enum ('requested', 'accepted', 'blocked');
create type public.post_scope as enum ('school', 'course');
create type public.share_status as enum ('enabled', 'disabled');

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null,
  office_code text not null,
  school_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id),
  display_name text not null,
  grade int not null check (grade between 1 and 3),
  class_name text not null,
  verification_status public.verification_status,
  account_status public.account_status not null default 'active',
  is_admin boolean not null default false,
  timetable_share_status public.share_status not null default 'disabled',
  friend_timetable_view_status public.share_status not null default 'disabled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id),
  storage_path text not null,
  status public.verification_status not null default 'pending',
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create or replace function public.apply_student_verification_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    verification_status = new.status,
    updated_at = now()
  where id = new.user_id;

  return new;
end;
$$;

create trigger apply_student_verification_status_after_write
  after insert or update of status on public.student_verifications
  for each row execute function public.apply_student_verification_status();

create table public.timetables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id),
  week_label text not null,
  source text not null check (source in ('manual', 'ocr')),
  source_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references public.timetables(id) on delete cascade,
  course_id text not null,
  day_of_week int not null check (day_of_week between 1 and 5),
  period int not null check (period between 0 and 12),
  start_time time not null,
  end_time time not null,
  subject text not null,
  teacher text,
  room text,
  created_at timestamptz not null default now()
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status public.friend_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  course_id text,
  author_id uuid not null references public.profiles(id) on delete cascade,
  scope public.post_scope not null,
  title text not null,
  body text not null,
  like_count int not null default 0,
  comment_count int not null default 0,
  view_count int not null default 0,
  report_count int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'school' and course_id is null) or (scope = 'course' and course_id is not null))
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  like_count int not null default 0,
  report_count int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  check ((post_id is not null and comment_id is null) or (post_id is null and comment_id is not null))
);

create unique index reports_one_post_per_reporter
  on public.reports (reporter_id, post_id)
  where post_id is not null;

create unique index reports_one_comment_per_reporter
  on public.reports (reporter_id, comment_id)
  where comment_id is not null;

create or replace function public.apply_report_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post_id uuid;
  was_hidden boolean;
  is_hidden boolean;
begin
  if new.post_id is not null then
    update public.posts
    set
      report_count = report_count + 1,
      hidden = (report_count + 1) >= 3,
      updated_at = now()
    where id = new.post_id;
  elsif new.comment_id is not null then
    select comments.post_id, comments.hidden
      into target_post_id, was_hidden
      from public.comments
      where comments.id = new.comment_id;

    update public.comments
    set
      report_count = report_count + 1,
      hidden = (report_count + 1) >= 3
    where id = new.comment_id
    returning hidden into is_hidden;

    if target_post_id is not null and was_hidden = false and is_hidden = true then
      update public.posts
      set
        comment_count = greatest(comment_count - 1, 0),
        updated_at = now()
      where id = target_post_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger apply_report_count_after_insert
  after insert on public.reports
  for each row execute function public.apply_report_count();

create table public.meal_menus (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  meal_date date not null,
  meal_type text not null,
  items text[] not null,
  calories text,
  source text not null default 'NEIS',
  created_at timestamptz not null default now(),
  unique (school_id, meal_date, meal_type)
);

create table public.notification_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  timetable boolean not null default true,
  meal boolean not null default true,
  community boolean not null default true,
  push_token text,
  updated_at timestamptz not null default now()
);

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.student_verifications enable row level security;
alter table public.timetables enable row level security;
alter table public.timetable_slots enable row level security;
alter table public.friendships enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.meal_menus enable row level security;
alter table public.notification_settings enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
      and account_status = 'active'
  );
$$;

create or replace function public.is_verified_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and verification_status = 'approved'
      and account_status = 'active'
  );
$$;

create or replace function public.can_update_own_profile(
  target_id uuid,
  next_verification_status public.verification_status,
  next_account_status public.account_status,
  next_is_admin boolean
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and verification_status is not distinct from next_verification_status
        and account_status = next_account_status
        and is_admin = next_is_admin
    );
$$;

create policy "schools are readable" on public.schools for select using (true);

create policy "profiles can read verified school peers"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.profiles viewer
      where viewer.id = auth.uid()
        and viewer.school_id = profiles.school_id
        and viewer.verification_status = 'approved'
        and viewer.account_status = 'active'
    )
  );

create policy "users create own profile" on public.profiles
  for insert with check (
    id = auth.uid()
    and verification_status is null
    and account_status = 'active'
    and is_admin = false
  );

create policy "users update own profile" on public.profiles
  for update using (id = auth.uid())
  with check (public.can_update_own_profile(id, verification_status, account_status, is_admin));

create policy "admins update profiles" on public.profiles
  for update using (public.is_admin()) with check (true);

create policy "users create own verification" on public.student_verifications
  for insert with check (
    user_id = auth.uid()
    and status = 'pending'
    and reviewer_id is null
    and reviewed_at is null
  );

create policy "users read own verification" on public.student_verifications
  for select using (user_id = auth.uid());

create policy "admins read verifications" on public.student_verifications
  for select using (public.is_admin());

create policy "admins review verifications" on public.student_verifications
  for update using (public.is_admin())
  with check (
    public.is_admin()
    and reviewer_id = auth.uid()
    and status in ('approved', 'rejected')
  );

create policy "users manage own timetables" on public.timetables
  for all using (user_id = auth.uid() and public.is_verified_user())
  with check (user_id = auth.uid() and public.is_verified_user());

create policy "users manage own timetable slots" on public.timetable_slots
  for all using (
    exists (select 1 from public.timetables where timetables.id = timetable_slots.timetable_id and timetables.user_id = auth.uid())
    and public.is_verified_user()
  )
  with check (
    exists (select 1 from public.timetables where timetables.id = timetable_slots.timetable_id and timetables.user_id = auth.uid())
    and public.is_verified_user()
  );

create policy "accepted friends read shared timetables" on public.timetables
  for select using (
    exists (
      select 1
      from public.friendships f
      join public.profiles owner on owner.id = timetables.user_id
      join public.profiles viewer on viewer.id = auth.uid()
      where f.status = 'accepted'
        and owner.timetable_share_status = 'enabled'
        and viewer.friend_timetable_view_status = 'enabled'
        and viewer.verification_status = 'approved'
        and viewer.account_status = 'active'
        and ((f.requester_id = auth.uid() and f.addressee_id = timetables.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = timetables.user_id))
    )
  );

create policy "users read own friendships" on public.friendships
  for select using (public.is_verified_user() and (requester_id = auth.uid() or addressee_id = auth.uid()));

create policy "users create friend requests" on public.friendships
  for insert with check (public.is_verified_user() and requester_id = auth.uid());

create policy "verified users read school posts" on public.posts
  for select using (
    hidden = false and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.school_id = posts.school_id
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
  );

create policy "verified users create school posts" on public.posts
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.school_id = posts.school_id
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
  );

create policy "admins manage posts" on public.posts
  for all using (public.is_admin()) with check (public.is_admin());

create policy "verified users read comments" on public.comments
  for select using (
    hidden = false and exists (
      select 1
      from public.posts
      join public.profiles on profiles.school_id = posts.school_id
      where posts.id = comments.post_id
        and profiles.id = auth.uid()
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
  );

create policy "verified users create comments" on public.comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
  );

create policy "admins manage comments" on public.comments
  for all using (public.is_admin()) with check (public.is_admin());

create policy "users read own reports" on public.reports
  for select using (reporter_id = auth.uid());

create policy "admins manage reports" on public.reports
  for all using (public.is_admin()) with check (public.is_admin());

create policy "verified users create reports" on public.reports
  for insert with check (
    reporter_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
    and (
      (
        post_id is not null
        and exists (
          select 1
          from public.posts
          join public.profiles on profiles.school_id = posts.school_id
          where posts.id = reports.post_id
            and posts.hidden = false
            and profiles.id = auth.uid()
            and profiles.verification_status = 'approved'
            and profiles.account_status = 'active'
        )
      )
      or (
        comment_id is not null
        and exists (
          select 1
          from public.comments
          join public.posts on posts.id = comments.post_id
          join public.profiles on profiles.school_id = posts.school_id
          where comments.id = reports.comment_id
            and comments.hidden = false
            and posts.hidden = false
            and profiles.id = auth.uid()
            and profiles.verification_status = 'approved'
            and profiles.account_status = 'active'
        )
      )
    )
  );

create policy "meal menus are readable to verified school users" on public.meal_menus
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.school_id = meal_menus.school_id
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
  );

create policy "users manage own notification settings" on public.notification_settings
  for all using (user_id = auth.uid() and public.is_verified_user())
  with check (user_id = auth.uid() and public.is_verified_user());

insert into storage.buckets (id, name, public)
values
  ('student-id-cards', 'student-id-cards', false),
  ('timetable-uploads', 'timetable-uploads', false)
on conflict (id) do nothing;

create policy "users upload own student id card"
  on storage.objects for insert
  with check (bucket_id = 'student-id-cards' and owner = auth.uid());

create policy "users upload own timetable images"
  on storage.objects for insert
  with check (bucket_id = 'timetable-uploads' and owner = auth.uid() and public.is_verified_user());

create policy "users read own private uploads"
  on storage.objects for select
  using (
    (bucket_id = 'student-id-cards' and owner = auth.uid())
    or (bucket_id = 'timetable-uploads' and owner = auth.uid() and public.is_verified_user())
  );

create policy "admins read student id cards"
  on storage.objects for select
  using (bucket_id = 'student-id-cards' and public.is_admin());
