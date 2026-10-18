-- City photos with their credit (2026-10-07): where a photo is from (unsplash | pexels), the photographer's page
-- and the photo's page, so the hero can say "Fotoğraf: <Ad> / Unsplash" with both linked. Builds on
-- city_image_cache.sql. The columns are nullable (older rows have none); the store function takes the new values
-- as parameters with defaults, so a caller with only (p_q, p_url, p_by) still works.
alter table trip_radar.city_image_cache
  add column if not exists source text,
  add column if not exists author_url text,
  add column if not exists photo_page text;

create or replace function public.city_image_cached(p_q text)
returns jsonb language sql security definer set search_path to '' as $$
  select jsonb_build_object('url', c.url, 'by', c.by, 'source', c.source, 'author_url', c.author_url, 'photo_page', c.photo_page, 'fetched_at', c.fetched_at)
  from trip_radar.city_image_cache c where c.q = p_q
$$;

-- A new parameter list is a new function in Postgres, not a replacement: the three-parameter one goes first, so a
-- call by name with three values has one function to land on.
drop function if exists public.city_image_store(text, text, text);
create or replace function public.city_image_store(
  p_q text, p_url text, p_by text,
  p_source text default null, p_author_url text default null, p_photo_page text default null
)
returns void language sql security definer set search_path to '' as $$
  insert into trip_radar.city_image_cache (q, url, by, source, author_url, photo_page, fetched_at)
  values (p_q, p_url, p_by, p_source, p_author_url, p_photo_page, now())
  on conflict (q) do update set url = excluded.url, by = excluded.by, source = excluded.source,
    author_url = excluded.author_url, photo_page = excluded.photo_page, fetched_at = excluded.fetched_at
$$;
revoke all on function public.city_image_cached(text) from public, anon, authenticated;
revoke all on function public.city_image_store(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.city_image_cached(text) to service_role;
grant execute on function public.city_image_store(text, text, text, text, text, text) to service_role;
