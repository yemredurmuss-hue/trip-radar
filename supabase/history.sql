-- Trip Radar · ortak ayar geçmişi (paylaşım güvenliği, 0.37)
--
-- schema.sql'den sonra bir kez çalıştırılır (tekrar çalıştırmak zararsızdır). Paylaşılan bir gezinin ortak
-- ayarları (ad, tarihler, bütçe, öncelikler, olanaklar, şartlar) her değiştiğinde eski ve yeni hâli buraya yazılır:
-- kim, ne zaman, neyi. İki taraf da eski bir hâli geri alabilir; geri almak normal put_trip_settings ile yazılır
-- ve o da geçmişe düşer.
--
-- put_trip_settings'e dokunulmaz: kaydı shared_trips üzerindeki tetikleyici yazar, böylece eski eklentilerin
-- yaptığı değişiklikler de geçmişe girer. Gezi başına en yeni 200 değişiklik tutulur.
-- Güvenlik schema.sql ile aynı: tabloya doğrudan erişim yok, yalnız gizli kimliği isteyen fonksiyon okur.

create table if not exists trip_radar.settings_history (
  id bigserial primary key,
  trip_id uuid not null references trip_radar.shared_trips(id) on delete cascade,
  author text,                                           -- değiştiren (shared_trips.updated_by)
  prev jsonb,                                            -- önceki ayarlar
  next jsonb,                                            -- yeni ayarlar
  created_at timestamptz not null default now()          -- değişikliğin zamanı (shared_trips.updated_at)
);
create index if not exists settings_history_trip_id on trip_radar.settings_history (trip_id, id desc);

alter table trip_radar.settings_history enable row level security;
revoke all on trip_radar.settings_history from public, anon, authenticated;
revoke all on sequence trip_radar.settings_history_id_seq from public, anon, authenticated;

-- --- tetikleyici: ayarlar gerçekten değişince bir satır, en fazla 200 ------------------------------

create or replace function trip_radar._settings_history_log() returns trigger
language plpgsql security definer set search_path = trip_radar, pg_temp as $$
begin
  if new.trip is distinct from old.trip then
    insert into settings_history (trip_id, author, prev, next, created_at)
    values (new.id, new.updated_by, old.trip, new.trip, coalesce(new.updated_at, now()));
    -- En yeni 200'ün dışında kalanlar gider (200'den azsa alt sorgu null döner, hiçbir şey silinmez).
    delete from settings_history h
    where h.trip_id = new.id
      and h.id < (
        select h2.id from settings_history h2
        where h2.trip_id = new.id
        order by h2.id desc
        offset 199 limit 1
      );
  end if;
  return null;
end $$;

drop trigger if exists shared_trips_settings_history on trip_radar.shared_trips;
create trigger shared_trips_settings_history
  after update on trip_radar.shared_trips
  for each row
  when (old.trip is distinct from new.trip)
  execute function trip_radar._settings_history_log();

-- --- fonksiyon (eklentinin çağırdığı) ------------------------------------------------------------

-- Bir paylaşılan gezinin ayar geçmişi, en yeniden eskiye, en fazla p_limit (1..200) satır.
create or replace function public.settings_history_for(p_id uuid, p_limit int default 50)
returns table (id bigint, author text, prev jsonb, next jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = trip_radar, pg_temp as $$
#variable_conflict use_column
begin
  perform _share_trip_exists(p_id);
  return query
    select h.id, h.author, h.prev, h.next, h.created_at
    from settings_history h
    where h.trip_id = p_id
    order by h.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $$;

-- --- yetkiler: yalnız bu fonksiyon dışarıya açık ---------------------------------------------------

revoke all on function trip_radar._settings_history_log() from public, anon, authenticated;
revoke all on function public.settings_history_for(uuid, int) from public;
grant execute on function public.settings_history_for(uuid, int) to anon, authenticated;
