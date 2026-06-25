-- =====================================================================
-- nlfr-if-distributie — schema
-- Project: communities-tools (Supabase)
-- Draai dit eenmalig in de Supabase SQL-editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Kanalen: de publish-doelen (Zapier-webhooks per social kanaal).
-- ---------------------------------------------------------------------
create table if not exists distributie_kanalen (
  id             uuid primary key default gen_random_uuid(),
  naam           text not null,
  type           text not null check (type in ('facebook_page','linkedin_profile','linkedin_company')),
  zapier_hook    text not null default '',  -- volledige webhook-URL van Zapier (leeg = nog niet gekoppeld)
  status         text not null default 'actief' check (status in ('actief','gepauzeerd','defect')),
  last_success   timestamptz,
  last_error     timestamptz,
  last_error_msg text,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Routes: welke bron-items naar welk kanaal gaan, met matching-regels.
-- ---------------------------------------------------------------------
create table if not exists distributie_routes (
  id            uuid primary key default gen_random_uuid(),
  bron          text not null check (bron in ('nlfr','if')),
  match_type    text not null check (match_type in ('alle','categorie_any','categorie_all')),
  match_waarden text[] not null default '{}',
  kanaal_id     uuid references distributie_kanalen(id) on delete cascade,
  status        text not null default 'actief' check (status in ('actief','gepauzeerd')),
  created_at    timestamptz not null default now()
);

create index if not exists idx_routes_bron_status on distributie_routes (bron, status);

-- ---------------------------------------------------------------------
-- Log: één rij per (post, kanaal). Dient ook als dedup-bron.
-- ---------------------------------------------------------------------
create table if not exists distributie_log (
  id           bigserial primary key,
  post_url     text not null,
  post_titel   text,
  bron         text,
  kanaal_id    uuid references distributie_kanalen(id) on delete set null,
  route_id     uuid references distributie_routes(id) on delete set null,
  status       text not null check (status in ('verzonden','overgeslagen_dedup','fout','wacht')),
  fout_msg     text,
  payload      jsonb,        -- verzonden payload (voor inspectie/replay)
  response     text,         -- HTTP-status + body van Zapier
  verzonden_op timestamptz not null default now(),
  unique (post_url, kanaal_id)
);

create index if not exists idx_log_verzonden_op on distributie_log (verzonden_op desc);
create index if not exists idx_log_kanaal on distributie_log (kanaal_id, verzonden_op desc);
create index if not exists idx_log_status on distributie_log (status, verzonden_op desc);

-- ---------------------------------------------------------------------
-- Admin-gebruikers: wie mag inloggen (magic-link). Eén owner (Anton).
-- ---------------------------------------------------------------------
create table if not exists admin_gebruikers (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  role       text not null default 'owner',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Alert-dedup: max 1 alert per (kanaal, type) per dedup-window.
-- ---------------------------------------------------------------------
create table if not exists alert_dedup (
  kanaal_id  uuid references distributie_kanalen(id) on delete cascade,
  alert_type text not null,
  laatst_op  timestamptz not null default now(),
  primary key (kanaal_id, alert_type)
);

-- ---------------------------------------------------------------------
-- Instellingen: single-row config voor de admin-UI (thresholds/email).
-- (Uitbreiding op het basis-schema: nodig om /admin/instellingen te
--  laten persisteren. Eén vaste rij met id = 1.)
-- ---------------------------------------------------------------------
create table if not exists distributie_instellingen (
  id                   int primary key default 1 check (id = 1),
  admin_email          text,
  stilte_uren          int not null default 6,
  foutburst_aantal     int not null default 3,
  foutburst_minuten    int not null default 60,
  alert_dedup_uren     int not null default 24,
  nlfr_feed_url        text,   -- onthoudt welke NLFR-feed-URL werkte (na fallback-detectie)
  updated_at           timestamptz not null default now()
);

insert into distributie_instellingen (id) values (1)
  on conflict (id) do nothing;

-- =====================================================================
-- Row Level Security
-- =====================================================================
-- De backend (cron, API-routes) gebruikt de service-role-key en omzeilt
-- RLS volledig. RLS hieronder beschermt tegen directe anon-toegang en
-- staat alleen ingelogde admin-gebruikers leesrechten toe.

alter table distributie_kanalen        enable row level security;
alter table distributie_routes         enable row level security;
alter table distributie_log            enable row level security;
alter table admin_gebruikers           enable row level security;
alter table alert_dedup                enable row level security;
alter table distributie_instellingen   enable row level security;

-- Helper: is de ingelogde gebruiker een admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_gebruikers
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Leesrechten voor ingelogde admins (writes lopen via service-role).
do $$
declare t text;
begin
  foreach t in array array[
    'distributie_kanalen','distributie_routes','distributie_log',
    'admin_gebruikers','alert_dedup','distributie_instellingen'
  ]
  loop
    execute format(
      'drop policy if exists admin_read on %I;', t
    );
    execute format(
      'create policy admin_read on %I for select to authenticated using (public.is_admin());', t
    );
  end loop;
end $$;
