alter table public.score_submissions
  add column if not exists is_admin_test boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'score_submissions'
      and constraint_name = 'score_submissions_exam_id_user_id_key'
  ) then
    alter table public.score_submissions
      drop constraint score_submissions_exam_id_user_id_key;
  end if;
end;
$$;

create unique index if not exists score_submissions_regular_user_unique
  on public.score_submissions (exam_id, user_id)
  where is_admin_test = false;

drop policy if exists "users read own score submissions" on public.score_submissions;
drop policy if exists "users create own score submissions" on public.score_submissions;
drop policy if exists "users update own score submissions" on public.score_submissions;
drop policy if exists "users delete own score submissions" on public.score_submissions;

create policy "users read own score submissions" on public.score_submissions
  for select using (
    user_id = (select auth.uid())
    and is_admin_test = false
    and public.can_access_score_exam(exam_id)
  );

create policy "users create own score submissions" on public.score_submissions
  for insert with check (
    user_id = (select auth.uid())
    and is_admin_test = false
    and public.can_access_score_exam(exam_id)
    and score <= (select max_score from public.score_exams where score_exams.id = score_submissions.exam_id)
  );

create policy "users update own score submissions" on public.score_submissions
  for update using (
    user_id = (select auth.uid())
    and is_admin_test = false
    and public.can_access_score_exam(exam_id)
  )
  with check (
    user_id = (select auth.uid())
    and is_admin_test = false
    and public.can_access_score_exam(exam_id)
    and score <= (select max_score from public.score_exams where score_exams.id = score_submissions.exam_id)
  );

create policy "users delete own score submissions" on public.score_submissions
  for delete using (
    user_id = (select auth.uid())
    and is_admin_test = false
    and public.can_access_score_exam(exam_id)
  );

create or replace function public.submit_score_submission(
  target_exam_id uuid,
  p_score numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  exam_max_score numeric;
begin
  if not public.can_access_score_exam(target_exam_id) then
    raise exception 'not allowed to submit score';
  end if;

  select max_score
    into exam_max_score
    from public.score_exams
    where id = target_exam_id;

  if p_score is null or p_score < 0 or p_score > exam_max_score then
    raise exception '점수를 확인해 주세요.';
  end if;

  update public.score_submissions
    set score = p_score,
        updated_at = now()
    where exam_id = target_exam_id
      and user_id = (select auth.uid())
      and is_admin_test = false;

  if not found then
    insert into public.score_submissions (exam_id, user_id, score, is_admin_test)
    values (target_exam_id, (select auth.uid()), p_score, false);
  end if;
end;
$$;

create or replace function public.submit_admin_score_test(
  target_exam_id uuid,
  p_score numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  exam_max_score numeric;
begin
  if not public.is_admin() or not public.can_access_score_exam(target_exam_id) then
    raise exception 'admin only';
  end if;

  select max_score
    into exam_max_score
    from public.score_exams
    where id = target_exam_id;

  if p_score is null or p_score < 0 or p_score > exam_max_score then
    raise exception '점수를 확인해 주세요.';
  end if;

  insert into public.score_submissions (exam_id, user_id, score, is_admin_test)
  values (target_exam_id, (select auth.uid()), p_score, true);
end;
$$;

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
      and user_id = (select auth.uid())
      and is_admin_test = false
    order by updated_at desc
    limit 1;

  if submission_count < 5 then
    return jsonb_build_object(
      'examId', target_exam_id,
      'ready', false,
      'submissionCount', submission_count,
      'anonymousScores', '[]'::jsonb,
      'myScore', own_score,
      'message', '5명 이상 필요'
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

grant execute on function public.submit_score_submission(uuid, numeric) to authenticated;
grant execute on function public.submit_admin_score_test(uuid, numeric) to authenticated;
grant execute on function public.get_score_exam_stats(uuid) to authenticated;
