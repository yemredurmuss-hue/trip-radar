-- Trip Radar öneri verisi: what the `offers` edge function heard from its sources (Aviasales' cached prices,
-- Tripadvisor's city ids, Xotelo's hotels and prices) and the offers it made of them, kept by what was asked, so
-- many travellers asking the same cost one call. A cap per source and day keeps the free quotas safe. Only places,
-- days, head-counts and the sources' public data are stored: no traveller, no trip.

create table if not exists trip_radar.offers_cache (
  key text primary key,                       -- "avia|IST|DPS|2026-11-10|a", "geo|ubud indonesia", "out|s|…"
  data jsonb,
  fetched_at timestamptz not null default now()
);
create table if not exists trip_radar.offers_calls (
  day date not null,                          -- UTC day
  source text not null,                       -- aviasales · tripadvisor · xotelo · links
  calls integer not null default 0,
  primary key (day, source)
);
revoke all on trip_radar.offers_cache, trip_radar.offers_calls from public, anon, authenticated;

create or replace function public.offers_cached(p_key text) returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('data', c.data, 'fetched_at', c.fetched_at) from trip_radar.offers_cache c where c.key = p_key
$$;

create or replace function public.offers_store(p_key text, p_data jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into trip_radar.offers_cache (key, data, fetched_at) values (p_key, p_data, now())
  on conflict (key) do update set data = excluded.data, fetched_at = excluded.fetched_at
$$;

-- One more call to this source today, if under its cap: true when it may go out.
create or replace function public.offers_take_call(p_source text, p_cap integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into trip_radar.offers_calls (day, source, calls) values ((now() at time zone 'utc')::date, p_source, 1)
  on conflict (day, source) do update set calls = trip_radar.offers_calls.calls + 1
  returning calls into n;
  if n > p_cap then
    update trip_radar.offers_calls set calls = calls - 1 where day = (now() at time zone 'utc')::date and source = p_source;
    return false;
  end if;
  return true;
end
$$;

revoke all on function public.offers_cached(text) from public, anon, authenticated;
revoke all on function public.offers_store(text, jsonb) from public, anon, authenticated;
revoke all on function public.offers_take_call(text, integer) from public, anon, authenticated;
grant execute on function public.offers_cached(text) to service_role;
grant execute on function public.offers_store(text, jsonb) to service_role;
grant execute on function public.offers_take_call(text, integer) to service_role;
