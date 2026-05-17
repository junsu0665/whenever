alter table public.notification_settings
  add column if not exists timetable_reminder_minutes integer not null default 10,
  add column if not exists lunch_reminder_time text not null default '11:20',
  add column if not exists dinner_reminder_time text not null default '16:30';

alter table public.timetables
  add column if not exists period_times jsonb not null default
    '{
      "1": { "startTime": "08:40", "endTime": "09:30" },
      "2": { "startTime": "09:40", "endTime": "10:30" },
      "3": { "startTime": "10:40", "endTime": "11:30" },
      "4": { "startTime": "11:40", "endTime": "12:30" },
      "5": { "startTime": "13:20", "endTime": "14:10" },
      "6": { "startTime": "14:20", "endTime": "15:10" },
      "7": { "startTime": "15:20", "endTime": "16:10" },
      "8": { "startTime": "16:20", "endTime": "17:10" }
    }'::jsonb;

update public.timetables
set period_times = coalesce(
  (
    select jsonb_object_agg(
      grouped.period::text,
      jsonb_build_object(
        'startTime', grouped.start_time,
        'endTime', grouped.end_time
      )
    )
    from (
      select
        slots.period,
        left(min(slots.start_time::text), 5) as start_time,
        left(max(slots.end_time::text), 5) as end_time
      from public.timetable_slots slots
      where slots.timetable_id = timetables.id
      group by slots.period
    ) grouped
  ),
  period_times
);
