-- Trip Radar · AI kapısı (0.36)
--
-- schema.sql'den sonra, aynı projenin SQL Editor'ünde bir kez çalıştırılır (tekrar çalıştırmak zararsızdır).
--
-- Davet ettiğin kişiler kendi AI anahtarı olmadan kullansın diye: eklenti modeli doğrudan değil, `ai` Edge
-- Function'ı üzerinden çağırır; Gemini anahtarı yalnız orada (Supabase secret GEMINI_API_KEY) durur. Her davet
-- bir bilet (token) taşır; kapı bileti, kişi başı günlük sınırı ve aylık bütçeyi bu tablolardan kontrol eder.
-- Tablolara ve aşağıdaki fonksiyonlara yalnız service_role (Edge Function'ların kendisi) erişir: anon anahtarı
-- olan biri bile bilet üretemez, harcamayı göremez. Sayfa içerikleri saklanmaz, yalnız sayılar.

create schema if not exists trip_radar;

create table if not exists trip_radar.ai_tokens (
  token text primary key,                                -- "trk_" + 48 hex: davet linkinin içindeki bilet
  name text not null,                                    -- kimin için ("Sabine · Porto")
  created_at timestamptz not null default now(),
  revoked_at timestamptz                                  -- kapatıldıysa: o bilet bir daha geçmez
);

create table if not exists trip_radar.ai_usage (
  token text not null references trip_radar.ai_tokens(token) on delete cascade,
  day date not null default current_date,
  requests integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cost_usd numeric(12, 6) not null default 0,            -- tahmini (fiyatlar Edge Function ortamından)
  primary key (token, day)
);

alter table trip_radar.ai_tokens enable row level security;
alter table trip_radar.ai_usage enable row level security;
revoke all on trip_radar.ai_tokens, trip_radar.ai_usage from public, anon, authenticated;

-- Kapının sorusu: bu bilet var mı, kapalı mı, bugün kaç istek, bu ay toplam ne harcandı.
create or replace function public.ai_gate_status(p_token text) returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'known', exists (select 1 from trip_radar.ai_tokens t where t.token = p_token),
    'revoked', exists (select 1 from trip_radar.ai_tokens t where t.token = p_token and t.revoked_at is not null),
    'today_requests', coalesce((select u.requests from trip_radar.ai_usage u where u.token = p_token and u.day = current_date), 0),
    'month_usd', coalesce((select sum(u.cost_usd) from trip_radar.ai_usage u where u.day >= date_trunc('month', current_date)::date), 0)
  );
$$;

create or replace function public.ai_gate_record(p_token text, p_in bigint, p_out bigint, p_cost numeric) returns void
language sql security definer set search_path = '' as $$
  insert into trip_radar.ai_usage as u (token, day, requests, input_tokens, output_tokens, cost_usd)
  values (p_token, current_date, 1, greatest(p_in, 0), greatest(p_out, 0), greatest(p_cost, 0))
  on conflict (token, day) do update set
    requests = u.requests + 1,
    input_tokens = u.input_tokens + excluded.input_tokens,
    output_tokens = u.output_tokens + excluded.output_tokens,
    cost_usd = u.cost_usd + excluded.cost_usd;
$$;

create or replace function public.ai_gate_add(p_token text, p_name text) returns void
language sql security definer set search_path = '' as $$
  insert into trip_radar.ai_tokens (token, name) values (p_token, left(coalesce(nullif(trim(p_name), ''), 'Davet'), 60));
$$;

create or replace function public.ai_gate_revoke(p_token_tail text) returns integer
language sql security definer set search_path = '' as $$
  with done as (
    update trip_radar.ai_tokens set revoked_at = now()
    where right(token, 6) = p_token_tail and revoked_at is null
    returning 1
  )
  select count(*)::integer from done;
$$;

-- Bu ayın dökümü: bilet başına (yalnız son 6 hanesi), toplam.
create or replace function public.ai_gate_usage() returns table (token_tail text, name text, created_at timestamptz, revoked boolean, month_requests bigint, month_usd numeric)
language sql security definer set search_path = '' as $$
  select right(t.token, 6), t.name, t.created_at, t.revoked_at is not null,
    coalesce(sum(u.requests), 0)::bigint, coalesce(sum(u.cost_usd), 0)
  from trip_radar.ai_tokens t
  left join trip_radar.ai_usage u on u.token = t.token and u.day >= date_trunc('month', current_date)::date
  group by t.token, t.name, t.created_at, t.revoked_at
  order by t.created_at;
$$;

revoke all on function public.ai_gate_status(text) from public, anon, authenticated;
revoke all on function public.ai_gate_record(text, bigint, bigint, numeric) from public, anon, authenticated;
revoke all on function public.ai_gate_add(text, text) from public, anon, authenticated;
revoke all on function public.ai_gate_revoke(text) from public, anon, authenticated;
revoke all on function public.ai_gate_usage() from public, anon, authenticated;
grant execute on function public.ai_gate_status(text) to service_role;
grant execute on function public.ai_gate_record(text, bigint, bigint, numeric) to service_role;
grant execute on function public.ai_gate_add(text, text) to service_role;
grant execute on function public.ai_gate_revoke(text) to service_role;
grant execute on function public.ai_gate_usage() to service_role;

-- --- 0.36.2: the owner and the key, set from the owner's extension (no dashboard work) ---------------------
-- The owner's computer claims the gate with a secret it made (only its SHA-256 is kept); the claim is approved
-- once (by hand: update trip_radar.ai_config set owner_approved = true); then that computer hands the gate its
-- Gemini key. The GEMINI_API_KEY / TR_ADMIN_SECRET function secrets still work and come first.
create table if not exists trip_radar.ai_config (
  id integer primary key default 1 check (id = 1),
  owner_hash text,
  owner_approved boolean not null default false,
  gemini_key text,
  updated_at timestamptz not null default now()
);
alter table trip_radar.ai_config enable row level security;
revoke all on trip_radar.ai_config from public, anon, authenticated;
insert into trip_radar.ai_config (id) values (1) on conflict (id) do nothing;

create or replace function public.ai_gate_config() returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('owner_hash', c.owner_hash, 'owner_approved', c.owner_approved, 'has_key', c.gemini_key is not null)
  from trip_radar.ai_config c where c.id = 1;
$$;

create or replace function public.ai_gate_key() returns text
language sql security definer set search_path = '' as $$
  select c.gemini_key from trip_radar.ai_config c where c.id = 1;
$$;

create or replace function public.ai_gate_claim(p_hash text) returns boolean
language sql security definer set search_path = '' as $$
  with done as (
    update trip_radar.ai_config set owner_hash = p_hash, updated_at = now()
    where id = 1 and not owner_approved and p_hash ~ '^[0-9a-f]{64}$'
    returning 1
  )
  select exists (select 1 from done);
$$;

create or replace function public.ai_gate_set_key(p_key text) returns void
language sql security definer set search_path = '' as $$
  update trip_radar.ai_config set gemini_key = nullif(trim(p_key), ''), updated_at = now() where id = 1;
$$;

revoke all on function public.ai_gate_config() from public, anon, authenticated;
revoke all on function public.ai_gate_key() from public, anon, authenticated;
revoke all on function public.ai_gate_claim(text) from public, anon, authenticated;
revoke all on function public.ai_gate_set_key(text) from public, anon, authenticated;
grant execute on function public.ai_gate_config() to service_role;
grant execute on function public.ai_gate_key() to service_role;
grant execute on function public.ai_gate_claim(text) to service_role;
grant execute on function public.ai_gate_set_key(text) to service_role;
