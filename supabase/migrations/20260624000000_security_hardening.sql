drop policy if exists "verified users create comments" on public.comments;

create policy "verified users create comments" on public.comments
  for insert with check (
    author_id = (select auth.uid())
    and exists (
      select 1
      from public.posts
      join public.profiles on profiles.school_id = posts.school_id
      where posts.id = comments.post_id
        and posts.hidden = false
        and profiles.id = (select auth.uid())
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
  );

drop policy if exists "users create own analytics events" on public.analytics_events;

create policy "verified users create own analytics events" on public.analytics_events
  for insert with check (
    user_id = (select auth.uid())
    and public.is_verified_user()
  );

drop policy if exists "users create own verification" on public.student_verifications;

create policy "users create own verification" on public.student_verifications
  for insert with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewer_id is null
    and reviewed_at is null
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.school_id = student_verifications.school_id
        and profiles.account_status = 'active'
    )
  );

drop policy if exists "users upload own student id card" on storage.objects;
drop policy if exists "users upload own timetable images" on storage.objects;

create policy "users upload own student id card"
  on storage.objects for insert
  with check (
    bucket_id = 'student-id-cards'
    and owner = (select auth.uid())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users upload own timetable images"
  on storage.objects for insert
  with check (
    bucket_id = 'timetable-uploads'
    and owner = (select auth.uid())
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_verified_user()
  );

drop policy if exists "verified users create own ad impressions" on public.ad_impressions;
drop policy if exists "verified users create own ad clicks" on public.ad_clicks;
drop policy if exists "verified users create own ad feedback" on public.ad_feedback;

create policy "verified users create own ad impressions" on public.ad_impressions
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
        and (ad_impressions.school_id is null or ad_impressions.school_id = profiles.school_id)
    )
  );

create policy "verified users create own ad clicks" on public.ad_clicks
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
        and (ad_clicks.school_id is null or ad_clicks.school_id = profiles.school_id)
    )
  );

create policy "verified users create own ad feedback" on public.ad_feedback
  for insert with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
        and (ad_feedback.school_id is null or ad_feedback.school_id = profiles.school_id)
    )
  );
