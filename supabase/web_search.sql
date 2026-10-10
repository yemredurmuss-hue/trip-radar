-- Trip Radar web search (NOT applied yet): the cache and the counters behind the `web-search` Edge Function.
-- Run once in the SQL Editor of project zjkesdsbructiyflzqvq (running it again is harmless).
--
-- Only the search question is stored (normalised: lower case, one space, at most 200 characters) with the answer
-- and its sources: nothing about the person or the trip. Callers are counted per day by a SHA-256 hash of the
-- extension's install id (or of the address when there's none), never the id or the address itself. Tables and
-- functions are for service_role only (the function itself): anon and authenticated have no access.

create schema if not exists trip_radar;

create table if not exists trip_radar.search_cache (
  kind text not null check (kind in ('event_dates', 'fact', 'research')),
  q text not null,                             -- the normalised question
  year integer not null default 0,             -- the edition asked about; 0: none
  answer text,                                 -- null: nothing found (kept for a day)
  sources jsonb not null default '[]'::jsonb,  -- [{ title, url }]
  event jsonb,                                 -- event_dates: { start, end, place, official_url, confidence }
  fetched_at timestamptz not null default now(),
  primary key (kind, q, year)
);

create table if not exists trip_radar.search_calls (
  day date not null,                           -- UTC day
  caller text not null,                        -- '*' for everyone together; else 'i:<sha256>' / 'a:<sha256>'
  calls integer not null default 0,            -- calls to Gemini that day
  primary key (day, caller)
);

alter table trip_radar.search_cache enable row level security;
alter table trip_radar.search_calls enable row level security;
revoke all on trip_radar.search_cache, trip_radar.search_calls from public, anon, authenticated;

create or replace function public.search_cached(p_kind text, p_q text, p_year integer) returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('answer', c.answer, 'sources', c.sources, 'event', c.event, 'fetched_at', c.fetched_at)
  from trip_radar.search_cache c where c.kind = p_kind and c.q = p_q and c.year = p_year
$$;

create or replace function public.search_store(p_kind text, p_q text, p_year integer, p_answer text, p_sources jsonb, p_event jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into trip_radar.search_cache (kind, q, year, answer, sources, event, fetched_at)
  values (p_kind, left(p_q, 200), p_year, left(p_answer, 2000), coalesce(p_sources, '[]'::jsonb), p_event, now())
  on conflict (kind, q, year) do update set
    answer = excluded.answer, sources = excluded.sources, event = excluded.event, fetched_at = excluded.fetched_at
$$;

-- One more call today, if the caller is under their limit and everyone together under the cap:
-- 'ok' (counted), 'limited' (this caller's day is used up) or 'capped' (the day's cap is reached). Nothing is
-- counted when it isn't 'ok'.
create or replace function public.search_take_call(p_caller text, p_cap integer, p_per_caller integer) returns text
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'utc')::date;
  mine integer;
  everyone integer;
begin
  insert into trip_radar.search_calls (day, caller, calls) values (today, p_caller, 1)
  on conflict (day, caller) do update set calls = trip_radar.search_calls.calls + 1
  returning calls into mine;
  if mine > p_per_caller then
    update trip_radar.search_calls set calls = calls - 1 where day = today and caller = p_caller;
    return 'limited';
  end if;
  insert into trip_radar.search_calls (day, caller, calls) values (today, '*', 1)
  on conflict (day, caller) do update set calls = trip_radar.search_calls.calls + 1
  returning calls into everyone;
  if everyone > p_cap then
    update trip_radar.search_calls set calls = calls - 1 where day = today and caller in (p_caller, '*');
    return 'capped';
  end if;
  return 'ok';
end
$$;

revoke all on function public.search_cached(text, text, integer) from public, anon, authenticated;
revoke all on function public.search_store(text, text, integer, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.search_take_call(text, integer, integer) from public, anon, authenticated;
grant execute on function public.search_cached(text, text, integer) to service_role;
grant execute on function public.search_store(text, text, integer, text, jsonb, jsonb) to service_role;
grant execute on function public.search_take_call(text, integer, integer) to service_role;
