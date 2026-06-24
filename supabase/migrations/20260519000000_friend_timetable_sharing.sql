drop policy if exists "accepted friends read shared timetables" on public.timetables;
drop policy if exists "verified users read public shared timetables" on public.timetables;
drop policy if exists "verified users read public shared timetable slots" on public.timetable_slots;
drop policy if exists "users create friend requests" on public.friendships;
drop policy if exists "users accept inbound friend requests" on public.friendships;
drop policy if exists "users update own friendships" on public.friendships;
drop policy if exists "users delete own friendships" on public.friendships;

create policy "verified users read public shared timetables" on public.timetables
  for select using (
    user_id <> (select auth.uid())
    and exists (
      select 1
      from public.profiles owner
      join public.profiles viewer on viewer.id = (select auth.uid())
      where owner.id = timetables.user_id
        and owner.school_id = timetables.school_id
        and viewer.school_id = timetables.school_id
        and owner.verification_status = 'approved'
        and owner.account_status = 'active'
        and owner.timetable_share_status = 'enabled'
        and viewer.verification_status = 'approved'
        and viewer.account_status = 'active'
        and viewer.friend_timetable_view_status = 'enabled'
    )
  );

create policy "verified users read public shared timetable slots" on public.timetable_slots
  for select using (
    exists (
      select 1
      from public.timetables owner_timetable
      join public.profiles owner on owner.id = owner_timetable.user_id
      join public.profiles viewer on viewer.id = (select auth.uid())
      where owner_timetable.id = timetable_slots.timetable_id
        and owner_timetable.user_id <> (select auth.uid())
        and owner.school_id = owner_timetable.school_id
        and viewer.school_id = owner_timetable.school_id
        and owner.verification_status = 'approved'
        and owner.account_status = 'active'
        and owner.timetable_share_status = 'enabled'
        and viewer.verification_status = 'approved'
        and viewer.account_status = 'active'
        and viewer.friend_timetable_view_status = 'enabled'
    )
  );
