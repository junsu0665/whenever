create table if not exists public.sponsor_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  advertiser_name text not null,
  placement text not null,
  body text,
  cta_label text,
  destination_url text,
  target_region text,
  target_school_id uuid references public.schools(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sponsor_campaigns enable row level security;

create index if not exists sponsor_campaigns_active_placement_idx
  on public.sponsor_campaigns (placement, starts_at, ends_at)
  where status = 'active';

create index if not exists sponsor_campaigns_target_school_id_idx
  on public.sponsor_campaigns (target_school_id)
  where target_school_id is not null;

create policy "verified users read active sponsor campaigns" on public.sponsor_campaigns
  for select using (
    status = 'active'
    and starts_at <= now()
    and ends_at > now()
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.verification_status = 'approved'
        and profiles.account_status = 'active'
    )
    and (
      target_school_id is null
      or exists (
        select 1
        from public.profiles
        where profiles.id = (select auth.uid())
          and profiles.school_id = sponsor_campaigns.target_school_id
          and profiles.verification_status = 'approved'
          and profiles.account_status = 'active'
      )
    )
    and (
      target_region is null
      or exists (
        select 1
        from public.profiles
        join public.schools on schools.id = profiles.school_id
        where profiles.id = (select auth.uid())
          and schools.region = sponsor_campaigns.target_region
          and profiles.verification_status = 'approved'
          and profiles.account_status = 'active'
      )
    )
  );

create policy "admins manage sponsor campaigns" on public.sponsor_campaigns
  for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.ad_impressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  placement text not null,
  provider text not null,
  campaign_id text,
  created_at timestamptz not null default now()
);

alter table public.ad_impressions enable row level security;

create index if not exists ad_impressions_placement_created_at_idx
  on public.ad_impressions (placement, created_at desc);

create index if not exists ad_impressions_campaign_id_created_at_idx
  on public.ad_impressions (campaign_id, created_at desc)
  where campaign_id is not null;

create policy "verified users create own ad impressions" on public.ad_impressions
  for insert with check (
    user_id = (select auth.uid())
    and public.is_verified_user()
  );

create policy "admins read ad impressions" on public.ad_impressions
  for select using (public.is_admin());

create table if not exists public.ad_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  placement text not null,
  provider text not null,
  campaign_id text,
  destination_url text,
  created_at timestamptz not null default now()
);

alter table public.ad_clicks enable row level security;

create index if not exists ad_clicks_placement_created_at_idx
  on public.ad_clicks (placement, created_at desc);

create index if not exists ad_clicks_campaign_id_created_at_idx
  on public.ad_clicks (campaign_id, created_at desc)
  where campaign_id is not null;

create policy "verified users create own ad clicks" on public.ad_clicks
  for insert with check (
    user_id = (select auth.uid())
    and public.is_verified_user()
  );

create policy "admins read ad clicks" on public.ad_clicks
  for select using (public.is_admin());

create table if not exists public.ad_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  placement text not null,
  provider text not null,
  campaign_id text,
  action text not null check (action in ('hide', 'report')),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.ad_feedback enable row level security;

create index if not exists ad_feedback_placement_created_at_idx
  on public.ad_feedback (placement, created_at desc);

create policy "verified users create own ad feedback" on public.ad_feedback
  for insert with check (
    user_id = (select auth.uid())
    and public.is_verified_user()
  );

create policy "users read own ad feedback" on public.ad_feedback
  for select using (user_id = (select auth.uid()));

create policy "admins read ad feedback" on public.ad_feedback
  for select using (public.is_admin());

create table if not exists public.score_check_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  free_count int not null default 0 check (free_count >= 0),
  rewarded_count int not null default 0 check (rewarded_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.score_check_usage enable row level security;

create policy "users manage own score check usage" on public.score_check_usage
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_verified_user());

create policy "admins read score check usage" on public.score_check_usage
  for select using (public.is_admin());
