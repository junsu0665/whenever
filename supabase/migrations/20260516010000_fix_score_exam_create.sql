alter table public.score_exams
  alter column created_by set default auth.uid();

drop policy if exists "verified users create school grade score exams" on public.score_exams;

create policy "verified users create school grade score exams" on public.score_exams
  for insert with check (
    (created_by is null or created_by = (select auth.uid()))
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.school_id = score_exams.school_id
        and profiles.grade = score_exams.grade
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
  );

create or replace function public.create_score_exam(
  p_subject text,
  p_exam_name text,
  p_max_score numeric,
  p_total_students int default null
)
returns public.score_exams
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer public.profiles;
  result public.score_exams;
begin
  select *
    into viewer
    from public.profiles
    where id = (select auth.uid())
      and verification_status = 'approved'
      and account_status = 'active';

  if viewer.id is null then
    raise exception '학생 인증이 필요합니다.';
  end if;

  if viewer.school_id is null then
    raise exception '학교 정보가 필요합니다.';
  end if;

  if nullif(trim(p_subject), '') is null
    or nullif(trim(p_exam_name), '') is null
    or p_max_score is null
    or p_max_score <= 0
    or (p_total_students is not null and p_total_students <= 0) then
    raise exception '시험 정보가 올바르지 않습니다.';
  end if;

  select *
    into result
    from public.score_exams
    where school_id = viewer.school_id
      and grade = viewer.grade
      and lower(trim(subject)) = lower(trim(p_subject))
      and lower(trim(exam_name)) = lower(trim(p_exam_name))
    limit 1;

  if result.id is not null then
    return result;
  end if;

  insert into public.score_exams (
    school_id,
    grade,
    subject,
    exam_name,
    max_score,
    total_students,
    created_by
  )
  values (
    viewer.school_id,
    viewer.grade,
    trim(p_subject),
    trim(p_exam_name),
    p_max_score,
    p_total_students,
    viewer.id
  )
  returning * into result;

  return result;
exception
  when unique_violation then
    select *
      into result
      from public.score_exams
      where school_id = viewer.school_id
        and grade = viewer.grade
        and lower(trim(subject)) = lower(trim(p_subject))
        and lower(trim(exam_name)) = lower(trim(p_exam_name))
      limit 1;

    if result.id is not null then
      return result;
    end if;

    raise;
end;
$$;

grant execute on function public.create_score_exam(text, text, numeric, int) to authenticated;
