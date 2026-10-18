-- City photos cached across users (applied 2026-10-06 as migration trip_radar_city_image_cache).
-- The city-image function reads and writes it with the service role; anon and authenticated have no access.
create table if not exists trip_radar.city_image_cache (
  q text primary key,
  url text,
  by text,
  fetched_at timestamptz not null default now()
);
alter table trip_radar.city_image_cache enable row level security;
revoke all on trip_radar.city_image_cache from anon, authenticated;

create or replace function public.city_image_cached(p_q text)
returns jsonb language sql security definer set search_path to '' as $$
  select jsonb_build_object('url', c.url, 'by', c.by, 'fetched_at', c.fetched_at)
  from trip_radar.city_image_cache c where c.q = p_q
$$;
create or replace function public.city_image_store(p_q text, p_url text, p_by text)
returns void language sql security definer set search_path to '' as $$
  insert into trip_radar.city_image_cache (q, url, by, fetched_at) values (p_q, p_url, p_by, now())
  on conflict (q) do update set url = excluded.url, by = excluded.by, fetched_at = excluded.fetched_at
$$;
revoke all on function public.city_image_cached(text) from public, anon, authenticated;
revoke all on function public.city_image_store(text, text, text) from public, anon, authenticated;
grant execute on function public.city_image_cached(text) to service_role;
grant execute on function public.city_image_store(text, text, text) to service_role;
