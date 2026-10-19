-- Trip Radar: the fares the `offers` function has seen, one person's lowest per route, day and source, at most one row an
-- hour (spec 2026-10-19 SerpApi, item 4: the flight card's price history when Google's isn't asked). Only airports, a
-- day and a price: no traveller, no trip. Rows older than 120 days are dropped when new ones come in.
create table if not exists trip_radar.price_log (
  route text not null,                         -- "IST-OPO"
  day date not null,                           -- the flight's day
  source text not null,                        -- Aviasales · Kiwi · Google Flights
  seen_hour timestamptz not null default date_trunc('hour', now()),
  price integer not null check (price > 0),     -- euros, one person
  primary key (route, day, source, seen_hour)
);
alter table trip_radar.price_log enable row level security;

create or replace function public.price_log_add(p_route text, p_day date, p_price integer, p_source text) returns void
language sql security definer set search_path = '' as $$
  delete from trip_radar.price_log where seen_hour < now() - interval '120 days';
  insert into trip_radar.price_log (route, day, source, price) values (p_route, p_day, p_source, p_price)
  on conflict (route, day, source, seen_hour) do nothing;
$$;

create or replace function public.price_log_read(p_route text, p_day date)
returns table (seen_at timestamptz, price integer)
language sql security definer set search_path = '' stable as $$
  select seen_hour, price from trip_radar.price_log where route = p_route and day = p_day order by seen_hour;
$$;

revoke all on function public.price_log_add(text, date, integer, text) from public, anon, authenticated;
revoke all on function public.price_log_read(text, date) from public, anon, authenticated;
grant execute on function public.price_log_add(text, date, integer, text) to service_role;
grant execute on function public.price_log_read(text, date) to service_role;
