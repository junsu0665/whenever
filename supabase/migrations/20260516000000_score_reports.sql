create table if not exists public.score_exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade int not null check (grade between 1 and 3),
  subject text not null check (length(trim(subject)) > 0),
  exam_name text not null check (length(trim(exam_name)) > 0),
  max_score numeric(6, 2) not null check (max_score > 0),
  total_students int check (total_students > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists score_exams_school_grade_subject_exam_unique
  on public.score_exams (school_id, grade, lower(trim(subject)), lower(trim(exam_name)));

create index if not exists score_exams_school_grade_updated_at_idx
  on public.score_exams (school_id, grade, updated_at desc);

create table if not exists public.score_submissions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.score_exams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score numeric(6, 2) not null check (score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, user_id)
);

create index if not exists score_submissions_exam_score_idx
  on public.score_submissions (exam_id, score desc);

create index if not exists score_submissions_user_id_idx
  on public.score_submissions (user_id);

alter table public.score_exams enable row level security;
alter table public.score_submissions enable row level security;

create or replace function public.can_access_score_exam(target_exam_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.score_exams exams
    join public.profiles viewer on viewer.id = (select auth.uid())
    where exams.id = target_exam_id
      and viewer.school_id = exams.school_id
      and viewer.grade = exams.grade
      and viewer.verification_status = 'approved'
      and viewer.account_status = 'active'
  );
$$;

create or replace function public.touch_score_exam_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.score_exams set updated_at = now() where id = old.exam_id;
    return old;
  end if;

  new.updated_at = now();
  update public.score_exams set updated_at = now() where id = new.exam_id;
  return new;
end;
$$;

drop trigger if exists touch_score_exam_after_submission_write on public.score_submissions;
create trigger touch_score_exam_after_submission_write
  before insert or update on public.score_submissions
  for each row execute function public.touch_score_exam_updated_at();

drop trigger if exists touch_score_exam_after_submission_delete on public.score_submissions;
create trigger touch_score_exam_after_submission_delete
  after delete on public.score_submissions
  for each row execute function public.touch_score_exam_updated_at();

create policy "verified users read school grade score exams" on public.score_exams
  for select using (public.can_access_score_exam(id));

create policy "verified users create school grade score exams" on public.score_exams
  for insert with check (
    created_by = (select auth.uid())
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

create policy "users read own score submissions" on public.score_submissions
  for select using (user_id = (select auth.uid()) and public.can_access_score_exam(exam_id));

create policy "users create own score submissions" on public.score_submissions
  for insert with check (
    user_id = (select auth.uid())
    and public.can_access_score_exam(exam_id)
    and score <= (select max_score from public.score_exams where score_exams.id = score_submissions.exam_id)
  );

create policy "users update own score submissions" on public.score_submissions
  for update using (user_id = (select auth.uid()) and public.can_access_score_exam(exam_id))
  with check (
    user_id = (select auth.uid())
    and public.can_access_score_exam(exam_id)
    and score <= (select max_score from public.score_exams where score_exams.id = score_submissions.exam_id)
  );

create policy "users delete own score submissions" on public.score_submissions
  for delete using (user_id = (select auth.uid()) and public.can_access_score_exam(exam_id));

create or replace function public.get_score_exam_stats(target_exam_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  scores numeric[];
  submission_count int;
  cutoff_index int;
  cutoff_score numeric;
  own_score numeric;
  own_rank int;
begin
  if not public.can_access_score_exam(target_exam_id) then
    raise exception 'not allowed to read score exam';
  end if;

  select coalesce(array_agg(score order by score desc), '{}'::numeric[])
    into scores
    from public.score_submissions
    where exam_id = target_exam_id;

  submission_count := coalesce(array_length(scores, 1), 0);

  select score
    into own_score
    from public.score_submissions
    where exam_id = target_exam_id
      and user_id = (select auth.uid());

  if submission_count < 5 then
    return jsonb_build_object(
      'examId', target_exam_id,
      'ready', false,
      'submissionCount', submission_count,
      'anonymousScores', '[]'::jsonb,
      'myScore', own_score,
      'message', '제보가 5명 이상 모이면 익명 점수 현황을 보여줍니다.'
    );
  end if;

  cutoff_index := greatest(1, ceil(submission_count * 0.10)::int);
  cutoff_score := scores[cutoff_index];

  if own_score is not null then
    select count(*) + 1
      into own_rank
      from public.score_submissions
      where exam_id = target_exam_id
        and score > own_score;
  end if;

  return jsonb_build_object(
    'examId', target_exam_id,
    'ready', true,
    'submissionCount', submission_count,
    'anonymousScores', to_jsonb(scores),
    'topScore', scores[1],
    'topTenCutScore', cutoff_score,
    'topTenCount', (select count(*) from unnest(scores) as score_values(score_value) where score_value >= cutoff_score),
    'myScore', own_score,
    'myRank', own_rank,
    'myTopPercent', case when own_rank is null then null else round((own_rank::numeric / submission_count::numeric) * 100, 1) end
  );
end;
$$;

grant execute on function public.can_access_score_exam(uuid) to authenticated;
grant execute on function public.get_score_exam_stats(uuid) to authenticated;
