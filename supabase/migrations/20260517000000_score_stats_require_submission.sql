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
  is_admin_user boolean;
begin
  if not public.can_access_score_exam(target_exam_id) then
    raise exception 'not allowed to read score exam';
  end if;

  select public.is_admin()
    into is_admin_user;

  select score
    into own_score
    from public.score_submissions
    where exam_id = target_exam_id
      and user_id = (select auth.uid())
      and is_admin_test = false
    order by updated_at desc
    limit 1;

  if own_score is null and not is_admin_user then
    raise exception '점수를 제출해야 성적을 볼 수 있습니다.';
  end if;

  select coalesce(array_agg(score order by score desc), '{}'::numeric[])
    into scores
    from public.score_submissions
    where exam_id = target_exam_id;

  submission_count := coalesce(array_length(scores, 1), 0);

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

grant execute on function public.get_score_exam_stats(uuid) to authenticated;
