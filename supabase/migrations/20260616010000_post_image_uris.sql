alter table public.posts
  add column if not exists image_uris text[] not null default '{}';
