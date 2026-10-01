-- Trip Radar · paylaşım (0.28)
--
-- Bir kez, boş bir Supabase projesinin SQL Editor'ünde çalıştırılır (tekrar çalıştırmak zararsızdır).
--
-- Güvenlik modeli: tabloların hiçbirine doğrudan erişim yok (RLS açık, politika yok, anon/authenticated
-- yetkileri geri alındı). Eklenti yalnız aşağıdaki SECURITY DEFINER fonksiyonlarını çağırır ve her biri
-- gezinin gizli kimliğini (paylaşım kodunun içindeki uuid) ister. Kodu bilen, o geziyi okur ve yazar:
-- iki kişilik bir gezi için yeterli; kodu yalnız birlikte gezdiğin kişiye ver. Gizli kimlik 122 bit
-- rastgeledir, tahmin edilemez; gezilerin listesi hiçbir fonksiyonla alınamaz.

-- Tablolar ve yardımcılar kendi `trip_radar` şemasında durur (API'ye açık değil); başka işler için kullanılan
-- bir projede de çalışır ve onun tablolarına dokunmaz. Dışarıya yalnız aşağıdaki public fonksiyonlar açıktır.

create schema if not exists trip_radar;
revoke all on schema trip_radar from public, anon, authenticated;

-- --- tablolar -------------------------------------------------------------------------------------

create table if not exists trip_radar.shared_trips (
  id uuid primary key,                                   -- gizli paylaşım kimliği
  trip jsonb not null default '{}'::jsonb,              -- eşitlenen gezi ayarları (ad, tarihler, bütçe, öncelikler)
  members text[] not null default '{}',                  -- katılanların adları ("Emre", "Sabine")
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),         -- ayarların son değişimi (son yazan kazanır)
  updated_by text
);

create table if not exists trip_radar.shared_captures (
  seq bigint generated always as identity primary key,   -- sıra: "şundan sonrakiler" imleci (saat kaymasından bağımsız)
  id uuid not null unique,                               -- kaydın kendi kimliği (iki cihazda aynı: tekrar işlenmez)
  trip_id uuid not null references trip_radar.shared_trips(id) on delete cascade,
  author text not null,
  created_at timestamptz not null default now(),
  capture jsonb not null                                 -- url, title, pageText, jsonLd, ... küçük ekran görüntüsü
);
create index if not exists shared_captures_trip_seq on trip_radar.shared_captures (trip_id, seq);

create table if not exists trip_radar.shared_votes (
  trip_id uuid not null references trip_radar.shared_trips(id) on delete cascade,
  item_key text not null,                                -- seçeneğin iki cihazda aynı anahtarı (ilan/link)
  author text not null,
  vote smallint not null check (vote between -1 and 1),
  note text,
  updated_at timestamptz not null default now(),
  primary key (trip_id, item_key, author)
);

alter table trip_radar.shared_trips enable row level security;
alter table trip_radar.shared_captures enable row level security;
alter table trip_radar.shared_votes enable row level security;
revoke all on trip_radar.shared_trips, trip_radar.shared_captures, trip_radar.shared_votes from anon, authenticated;

-- --- yardımcılar ---------------------------------------------------------------------------------

create or replace function trip_radar._share_author(p_author text) returns text
language plpgsql immutable as $$
declare a text := btrim(coalesce(p_author, ''));
begin
  if a = '' or char_length(a) > 40 then
    raise exception 'bad_author' using errcode = '22023';
  end if;
  return a;
end $$;

create or replace function trip_radar._share_trip_exists(p_id uuid) returns void
language plpgsql stable security definer set search_path = trip_radar, pg_temp as $$
begin
  if not exists (select 1 from shared_trips where id = p_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end $$;

-- --- fonksiyonlar (eklentinin çağırdıkları) -------------------------------------------------------

-- Kurulum kontrolü: Ayarlar'daki "Bağlantıyı dene".
create or replace function public.share_ping() returns text
language sql stable as $$ select 'trip-radar-share-1'::text $$;

-- Yeni paylaşılan gezi. Kimliği eklenti üretir, böylece yarıda kalan bir deneme tekrarlanabilir.
create or replace function public.create_shared_trip(p_id uuid, p_trip jsonb, p_author text)
returns timestamptz
language plpgsql security definer set search_path = trip_radar, pg_temp as $$
declare a text := _share_author(p_author); t timestamptz;
begin
  if p_id is null then raise exception 'bad_id' using errcode = '22023'; end if;
  if octet_length(coalesce(p_trip, '{}'::jsonb)::text) > 20000 then
    raise exception 'too_large' using errcode = '22023';
  end if;
  insert into shared_trips (id, trip, members, updated_by)
  values (p_id, coalesce(p_trip, '{}'::jsonb), array[a], a)
  on conflict (id) do nothing;
  select updated_at into t from shared_trips where id = p_id;
  return t;
end $$;

-- Gezinin ayarları ve katılanlar. p_author verilirse katılanlara eklenir ("Sabine ile").
create or replace function public.get_shared_trip(p_id uuid, p_author text default null)
returns table (trip jsonb, members text[], updated_at timestamptz, updated_by text)
language plpgsql security definer set search_path = trip_radar, pg_temp as $$
#variable_conflict use_column
begin
  perform _share_trip_exists(p_id);
  if p_author is not null and btrim(p_author) <> '' then
    update shared_trips s set members = array_append(s.members, _share_author(p_author))
    where s.id = p_id and not (_share_author(p_author) = any(s.members)) and cardinality(s.members) < 10;
  end if;
  return query select s.trip, s.members, s.updated_at, s.updated_by from shared_trips s where s.id = p_id;
end $$;

-- Ayarları yazar (son yazan kazanır; kimin yazdığını eklenti karşılaştırır).
create or replace function public.put_trip_settings(p_id uuid, p_trip jsonb, p_author text)
returns timestamptz
language plpgsql security definer set search_path = trip_radar, pg_temp as $$
declare a text := _share_author(p_author); t timestamptz;
begin
  perform _share_trip_exists(p_id);
  if octet_length(coalesce(p_trip, '{}'::jsonb)::text) > 20000 then
    raise exception 'too_large' using errcode = '22023';
  end if;
  update shared_trips set trip = coalesce(p_trip, '{}'::jsonb), updated_at = clock_timestamp(), updated_by = a
  where id = p_id
  returning updated_at into t;
  return t;
end $$;

-- Bir kaydı ekler. Aynı kimlik ikinci kez gelirse yeni satır açılmaz; sırası döner.
create or replace function public.add_capture(p_trip_id uuid, p_id uuid, p_author text, p_capture jsonb)
returns bigint
language plpgsql security definer set search_path = trip_radar, pg_temp as $$
declare a text := _share_author(p_author); s bigint;
begin
  perform _share_trip_exists(p_trip_id);
  if p_id is null or p_capture is null then raise exception 'bad_capture' using errcode = '22023'; end if;
  if octet_length(p_capture::text) > 1000000 then
    raise exception 'too_large' using errcode = '22023';
  end if;
  select c.seq into s from shared_captures c where c.id = p_id;
  if s is not null then return s; end if;
  if (select count(*) from shared_captures c where c.trip_id = p_trip_id) >= 1500 then
    raise exception 'trip_full' using errcode = '22023';
  end if;
  insert into shared_captures (id, trip_id, author, capture) values (p_id, p_trip_id, a, p_capture)
  on conflict (id) do nothing
  returning seq into s;
  if s is null then select c.seq into s from shared_captures c where c.id = p_id; end if;
  return s;
end $$;

-- p_since sırasından sonraki kayıtlar, en fazla p_limit tane (büyük olabilirler: sayfa sayfa alınır).
create or replace function public.captures_since(p_trip_id uuid, p_since bigint default 0, p_limit int default 10)
returns table (seq bigint, id uuid, author text, created_at timestamptz, capture jsonb)
language plpgsql security definer set search_path = trip_radar, pg_temp as $$
#variable_conflict use_column
begin
  perform _share_trip_exists(p_trip_id);
  return query
    select c.seq, c.id, c.author, c.created_at, c.capture
    from shared_captures c
    where c.trip_id = p_trip_id and c.seq > coalesce(p_since, 0)
    order by c.seq
    limit least(greatest(coalesce(p_limit, 10), 1), 25);
end $$;

-- Bir kişinin bir seçeneğe oyu: 1 👍, -1 👎, 0 oyu geri al.
create or replace function public.set_vote(p_trip_id uuid, p_item_key text, p_author text, p_vote smallint, p_note text default null)
returns timestamptz
language plpgsql security definer set search_path = trip_radar, pg_temp as $$
declare a text := _share_author(p_author); t timestamptz;
begin
  perform _share_trip_exists(p_trip_id);
  if p_item_key is null or char_length(p_item_key) = 0 or char_length(p_item_key) > 300 then
    raise exception 'bad_item_key' using errcode = '22023';
  end if;
  if p_vote is null or p_vote not between -1 and 1 then raise exception 'bad_vote' using errcode = '22023'; end if;
  if p_note is not null and char_length(p_note) > 500 then raise exception 'too_large' using errcode = '22023'; end if;
  if (select count(*) from shared_votes v where v.trip_id = p_trip_id) >= 5000 then
    raise exception 'trip_full' using errcode = '22023';
  end if;
  insert into shared_votes as v (trip_id, item_key, author, vote, note, updated_at)
  values (p_trip_id, p_item_key, a, p_vote, p_note, clock_timestamp())
  on conflict (trip_id, item_key, author)
  do update set vote = excluded.vote, note = excluded.note, updated_at = excluded.updated_at
  returning v.updated_at into t;
  return t;
end $$;

create or replace function public.votes_for(p_trip_id uuid)
returns table (item_key text, author text, vote smallint, note text, updated_at timestamptz)
language plpgsql security definer set search_path = trip_radar, pg_temp as $$
#variable_conflict use_column
begin
  perform _share_trip_exists(p_trip_id);
  return query select v.item_key, v.author, v.vote, v.note, v.updated_at from shared_votes v where v.trip_id = p_trip_id;
end $$;

-- --- yetkiler: yalnız bu fonksiyonlar dışarıya açık ------------------------------------------------

revoke all on function trip_radar._share_author(text) from public, anon, authenticated;
revoke all on function trip_radar._share_trip_exists(uuid) from public, anon, authenticated;

revoke all on function public.share_ping() from public;
revoke all on function public.create_shared_trip(uuid, jsonb, text) from public;
revoke all on function public.get_shared_trip(uuid, text) from public;
revoke all on function public.put_trip_settings(uuid, jsonb, text) from public;
revoke all on function public.add_capture(uuid, uuid, text, jsonb) from public;
revoke all on function public.captures_since(uuid, bigint, int) from public;
revoke all on function public.set_vote(uuid, text, text, smallint, text) from public;
revoke all on function public.votes_for(uuid) from public;

grant execute on function public.share_ping() to anon, authenticated;
grant execute on function public.create_shared_trip(uuid, jsonb, text) to anon, authenticated;
grant execute on function public.get_shared_trip(uuid, text) to anon, authenticated;
grant execute on function public.put_trip_settings(uuid, jsonb, text) to anon, authenticated;
grant execute on function public.add_capture(uuid, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.captures_since(uuid, bigint, int) to anon, authenticated;
grant execute on function public.set_vote(uuid, text, text, smallint, text) to anon, authenticated;
grant execute on function public.votes_for(uuid) to anon, authenticated;
