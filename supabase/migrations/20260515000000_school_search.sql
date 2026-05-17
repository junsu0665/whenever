create or replace function public.upsert_school_by_code(
  p_name text,
  p_region text,
  p_office_code text,
  p_school_code text
)
returns public.schools
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.schools;
begin
  if nullif(trim(p_name), '') is null
    or nullif(trim(p_office_code), '') is null
    or nullif(trim(p_school_code), '') is null then
    raise exception '학교 정보가 올바르지 않습니다.';
  end if;

  insert into public.schools (name, region, office_code, school_code)
  values (
    trim(p_name),
    coalesce(nullif(trim(p_region), ''), '지역 미상'),
    trim(p_office_code),
    trim(p_school_code)
  )
  on conflict (school_code) do update
  set
    name = excluded.name,
    region = excluded.region,
    office_code = excluded.office_code
  returning * into result;

  return result;
end;
$$;

grant execute on function public.upsert_school_by_code(text, text, text, text) to authenticated;
