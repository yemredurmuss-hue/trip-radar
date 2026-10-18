-- Trip Radar · profiller (0.36)
--
-- schema.sql'den sonra bir kez çalıştırılır (tekrar çalıştırmak zararsızdır). Paylaşılan bir gezinin
-- üyelerinin küçük profil fotoğrafı: yalnız o gezinin gizli kimliğini bilenler görür, başka hiçbir yere gitmez.
-- Fotoğraf eklentide 128 px JPEG'e küçültülür (~10 KB); sunucu 60 KB'tan büyüğünü almaz.

create table if not exists trip_radar.shared_profiles (
  share_id uuid not null references trip_radar.shared_trips(id) on delete cascade,
  author text not null,
  photo text,                                             -- data:image/jpeg;base64,… ya da null (kaldırıldı)
  updated_at timestamptz not null default now(),
  primary key (share_id, author)
);
alter table trip_radar.shared_profiles enable row level security;
revoke all on trip_radar.shared_profiles from public, anon, authenticated;

create or replace function public.put_profile(p_id uuid, p_author text, p_photo text) returns void
language plpgsql security definer set search_path = trip_radar, pg_temp as $$
declare a text := _share_author(p_author);
begin
  perform _share_trip_exists(p_id);
  if p_photo is not null and (p_photo not like 'data:image/jpeg;base64,%' or char_length(p_photo) > 60000) then
    raise exception 'bad_photo' using errcode = '22023';
  end if;
  insert into shared_profiles (share_id, author, photo) values (p_id, a, p_photo)
  on conflict (share_id, author) do update set photo = excluded.photo, updated_at = now();
end $$;

create or replace function public.profiles_for(p_id uuid) returns table (author text, photo text)
language plpgsql stable security definer set search_path = trip_radar, pg_temp as $$
begin
  perform _share_trip_exists(p_id);
  return query select p.author, p.photo from shared_profiles p where p.share_id = p_id and p.photo is not null;
end $$;

revoke all on function public.put_profile(uuid, text, text) from public;
revoke all on function public.profiles_for(uuid) from public;
grant execute on function public.put_profile(uuid, text, text) to anon, authenticated;
grant execute on function public.profiles_for(uuid) to anon, authenticated;
