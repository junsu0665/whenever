insert into public.schools (id, name, region, office_code, school_code)
values
  ('00000000-0000-0000-0000-000000000001', '서울시 OO고등학교', '서울', 'B10', '7010057')
on conflict (school_code) do nothing;

create index if not exists profiles_school_id_idx on public.profiles (school_id);
create index if not exists profiles_verification_status_idx on public.profiles (verification_status);
create index if not exists student_verifications_user_id_idx on public.student_verifications (user_id);
create index if not exists student_verifications_school_id_status_idx on public.student_verifications (school_id, status);
create index if not exists timetables_user_id_updated_at_idx on public.timetables (user_id, updated_at desc);
create index if not exists timetables_school_id_idx on public.timetables (school_id);
create index if not exists timetable_slots_timetable_id_idx on public.timetable_slots (timetable_id);
create index if not exists friendships_requester_id_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_id_idx on public.friendships (addressee_id);
create index if not exists posts_school_id_created_at_idx on public.posts (school_id, created_at desc);
create index if not exists posts_author_id_idx on public.posts (author_id);
create index if not exists posts_course_id_idx on public.posts (course_id) where course_id is not null;
create index if not exists comments_post_id_created_at_idx on public.comments (post_id, created_at);
create index if not exists comments_author_id_idx on public.comments (author_id);
create index if not exists reports_reporter_id_idx on public.reports (reporter_id);
create index if not exists reports_post_id_idx on public.reports (post_id) where post_id is not null;
create index if not exists reports_comment_id_idx on public.reports (comment_id) where comment_id is not null;
create index if not exists meal_menus_school_id_meal_date_idx on public.meal_menus (school_id, meal_date desc);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.post_likes enable row level security;
alter table public.comment_likes enable row level security;

create index if not exists post_likes_user_id_idx on public.post_likes (user_id);
create index if not exists comment_likes_user_id_idx on public.comment_likes (user_id);

create or replace function public.apply_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set like_count = like_count + 1,
        updated_at = now()
    where id = new.post_id;
    return new;
  end if;

  update public.posts
  set like_count = greatest(like_count - 1, 0),
      updated_at = now()
  where id = old.post_id;
  return old;
end;
$$;

drop trigger if exists apply_post_like_count_after_insert on public.post_likes;
create trigger apply_post_like_count_after_insert
  after insert on public.post_likes
  for each row execute function public.apply_post_like_count();

drop trigger if exists apply_post_like_count_after_delete on public.post_likes;
create trigger apply_post_like_count_after_delete
  after delete on public.post_likes
  for each row execute function public.apply_post_like_count();

create or replace function public.apply_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments
    set like_count = like_count + 1
    where id = new.comment_id;
    return new;
  end if;

  update public.comments
  set like_count = greatest(like_count - 1, 0)
  where id = old.comment_id;
  return old;
end;
$$;

drop trigger if exists apply_comment_like_count_after_insert on public.comment_likes;
create trigger apply_comment_like_count_after_insert
  after insert on public.comment_likes
  for each row execute function public.apply_comment_like_count();

drop trigger if exists apply_comment_like_count_after_delete on public.comment_likes;
create trigger apply_comment_like_count_after_delete
  after delete on public.comment_likes
  for each row execute function public.apply_comment_like_count();

create or replace function public.apply_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.hidden = false then
    update public.posts
    set comment_count = comment_count + 1,
        updated_at = now()
    where id = new.post_id;
    return new;
  end if;

  if tg_op = 'DELETE' and old.hidden = false then
    update public.posts
    set comment_count = greatest(comment_count - 1, 0),
        updated_at = now()
    where id = old.post_id;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.hidden is distinct from new.hidden then
    update public.posts
    set comment_count = greatest(comment_count + case when new.hidden then -1 else 1 end, 0),
        updated_at = now()
    where id = new.post_id;
    return new;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists apply_comment_count_after_insert on public.comments;
create trigger apply_comment_count_after_insert
  after insert on public.comments
  for each row execute function public.apply_comment_count();

drop trigger if exists apply_comment_count_after_delete on public.comments;
create trigger apply_comment_count_after_delete
  after delete on public.comments
  for each row execute function public.apply_comment_count();

drop trigger if exists apply_comment_count_after_hidden_update on public.comments;
create trigger apply_comment_count_after_hidden_update
  after update of hidden on public.comments
  for each row execute function public.apply_comment_count();

create or replace function public.increment_post_view(target_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.is_admin()
    or exists (
      select 1
      from public.posts
      join public.profiles on profiles.school_id = posts.school_id
      where posts.id = target_post_id
        and posts.hidden = false
        and profiles.id = (select auth.uid())
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
  ) then
    raise exception 'not allowed to view post';
  end if;

  update public.posts
  set view_count = view_count + 1,
      updated_at = now()
  where id = target_post_id;
end;
$$;

create policy "users read own post likes" on public.post_likes
  for select using (user_id = (select auth.uid()));

create policy "verified users create post likes" on public.post_likes
  for insert with check (
    user_id = (select auth.uid())
    and public.is_verified_user()
    and exists (
      select 1
      from public.posts
      join public.profiles on profiles.school_id = posts.school_id
      where posts.id = post_likes.post_id
        and posts.hidden = false
        and profiles.id = (select auth.uid())
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
  );

create policy "users delete own post likes" on public.post_likes
  for delete using (user_id = (select auth.uid()));

create policy "users read own comment likes" on public.comment_likes
  for select using (user_id = (select auth.uid()));

create policy "verified users create comment likes" on public.comment_likes
  for insert with check (
    user_id = (select auth.uid())
    and public.is_verified_user()
    and exists (
      select 1
      from public.comments
      join public.posts on posts.id = comments.post_id
      join public.profiles on profiles.school_id = posts.school_id
      where comments.id = comment_likes.comment_id
        and comments.hidden = false
        and posts.hidden = false
        and profiles.id = (select auth.uid())
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
  );

create policy "users delete own comment likes" on public.comment_likes
  for delete using (user_id = (select auth.uid()));

create policy "admins manage post likes" on public.post_likes
  for all using (public.is_admin()) with check (public.is_admin());

create policy "admins manage comment likes" on public.comment_likes
  for all using (public.is_admin()) with check (public.is_admin());
