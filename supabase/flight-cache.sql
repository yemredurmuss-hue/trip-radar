-- Trip Radar uçuş verisi (0.36.15): a booked flight's real schedule and, on the day, its status, gate, terminal
-- and baggage belt, from AeroDataBox (RapidAPI). The edge function `flight` asks for it with the key kept as a
-- Supabase secret (AERODATABOX_KEY); answers are cached by flight number and day, so a flight costs a few calls
-- however many travellers look at it, and a cap per day keeps the subscription's quota safe. Only the flight's
-- public data is stored: no traveller, no trip.

create table if not exists trip_radar.flight_cache (
  number text not null,                       -- "KL1577" (no spaces, upper case)
  day date not null,                          -- its departure day, local
  data jsonb,                                 -- the flight as the extension reads it (null: none found)
  fetched_at timestamptz not null default now(),
  primary key (number, day)
);
create table if not exists trip_radar.flight_calls (
  day date primary key,                       -- UTC day
  calls integer not null default 0            -- calls to AeroDataBox that day
);
revoke all on trip_radar.flight_cache, trip_radar.flight_calls from public, anon, authenticated;

create or replace function public.flight_cached(p_number text, p_day date) returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('data', c.data, 'fetched_at', c.fetched_at)
  from trip_radar.flight_cache c where c.number = p_number and c.day = p_day
$$;

create or replace function public.flight_store(p_number text, p_day date, p_data jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into trip_radar.flight_cache (number, day, data, fetched_at) values (p_number, p_day, p_data, now())
  on conflict (number, day) do update set data = excluded.data, fetched_at = excluded.fetched_at
$$;

-- One more call today, if under the cap: true when it may go out.
create or replace function public.flight_take_call(p_cap integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into trip_radar.flight_calls (day, calls) values ((now() at time zone 'utc')::date, 1)
  on conflict (day) do update set calls = trip_radar.flight_calls.calls + 1
  returning calls into n;
  if n > p_cap then
    update trip_radar.flight_calls set calls = calls - 1 where day = (now() at time zone 'utc')::date;
    return false;
  end if;
  return true;
end
$$;

revoke all on function public.flight_cached(text, date) from public, anon, authenticated;
revoke all on function public.flight_store(text, date, jsonb) from public, anon, authenticated;
revoke all on function public.flight_take_call(integer) from public, anon, authenticated;
grant execute on function public.flight_cached(text, date) to service_role;
grant execute on function public.flight_store(text, date, jsonb) to service_role;
grant execute on function public.flight_take_call(integer) to service_role;
