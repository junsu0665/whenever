create or replace function public.get_score_subject_candidates()
returns table(subject text, occurrence_count int)
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select id, school_id, grade
    from public.profiles
    where id = (select auth.uid())
      and verification_status = 'approved'
      and account_status = 'active'
    limit 1
  ),
  candidates as (
    select trim(slots.subject) as subject
    from viewer
    join public.profiles owners
      on owners.school_id = viewer.school_id
     and owners.grade = viewer.grade
     and owners.verification_status = 'approved'
     and owners.account_status = 'active'
    join public.timetables timetables
      on timetables.user_id = owners.id
     and timetables.school_id = owners.school_id
    join public.timetable_slots slots
      on slots.timetable_id = timetables.id
    where length(trim(slots.subject)) > 0
      and (
        owners.id = viewer.id
        or owners.timetable_share_status = 'enabled'
        or public.is_admin()
      )
  )
  select subject, count(*)::int as occurrence_count
  from candidates
  group by lower(subject), subject
  order by count(*) desc, subject asc;
$$;

grant execute on function public.get_score_subject_candidates() to authenticated;
