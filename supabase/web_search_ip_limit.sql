-- Trip Radar web search: the limit per address as well as per install (NOT applied yet). Apply after web_search.sql
-- and BEFORE deploying the web-search function that calls search_take_call2 (until then that function answers
-- "capped"). Running it again is harmless.
--
-- A fresh install id with every call must not get round the 30 a day per install: the caller's address (a SHA-256
-- hash, never the address itself) has its own limit, 60 a day. A call goes out only when the install (if one was
-- sent), the address and everyone together are all under their limits; otherwise nothing is counted.
-- search_take_call (one caller) stays for the function deployed now; it can be dropped once the new one is live.

create or replace function public.search_take_call2(p_install text, p_ip text, p_cap integer, p_per_install integer, p_per_ip integer) returns text
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'utc')::date;
  n integer;
begin
  -- The install (when sent): one more, unless it's over.
  if p_install is not null then
    insert into trip_radar.search_calls (day, caller, calls) values (today, p_install, 1)
    on conflict (day, caller) do update set calls = trip_radar.search_calls.calls + 1
    returning calls into n;
    if n > p_per_install then
      update trip_radar.search_calls set calls = calls - 1 where day = today and caller = p_install;
      return 'limited';
    end if;
  end if;
  -- The address.
  insert into trip_radar.search_calls (day, caller, calls) values (today, p_ip, 1)
  on conflict (day, caller) do update set calls = trip_radar.search_calls.calls + 1
  returning calls into n;
  if n > p_per_ip then
    update trip_radar.search_calls set calls = calls - 1 where day = today and caller in (p_ip, coalesce(p_install, p_ip));
    return 'limited';
  end if;
  -- Everyone together.
  insert into trip_radar.search_calls (day, caller, calls) values (today, '*', 1)
  on conflict (day, caller) do update set calls = trip_radar.search_calls.calls + 1
  returning calls into n;
  if n > p_cap then
    update trip_radar.search_calls set calls = calls - 1 where day = today and caller in ('*', p_ip, coalesce(p_install, p_ip));
    return 'capped';
  end if;
  return 'ok';
end
$$;

revoke all on function public.search_take_call2(text, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.search_take_call2(text, text, integer, integer, integer) to service_role;
