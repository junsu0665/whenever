drop policy if exists "admins delete score exams" on public.score_exams;

create policy "admins delete score exams" on public.score_exams
  for delete using (public.is_admin() and public.can_access_score_exam(id));

create or replace function public.delete_score_exam(target_exam_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() or not public.can_access_score_exam(target_exam_id) then
    raise exception 'admin only';
  end if;

  delete from public.score_exams
  where id = target_exam_id;
end;
$$;

grant execute on function public.delete_score_exam(uuid) to authenticated;
