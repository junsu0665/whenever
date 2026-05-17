create policy "authors read own posts" on public.posts
  for select using (author_id = (select auth.uid()));

create policy "authors delete own posts" on public.posts
  for delete using (author_id = (select auth.uid()) and public.is_verified_user());

create policy "authors read own comments" on public.comments
  for select using (author_id = (select auth.uid()));

create policy "authors delete own comments" on public.comments
  for delete using (author_id = (select auth.uid()) and public.is_verified_user());
