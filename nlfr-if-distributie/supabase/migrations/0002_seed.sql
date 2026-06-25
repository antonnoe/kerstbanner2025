-- =====================================================================
-- nlfr-if-distributie — seed-data
-- Draai NA 0001_schema.sql. Idempotent (veilig om te herhalen).
-- Zapier-hooks zijn leeg: Anton vult ze in via /admin/kanalen na het
-- aanmaken van de Zaps (zie ZAPIER-SETUP.md).
-- =====================================================================

-- --- Admin-gebruiker -------------------------------------------------
insert into admin_gebruikers (email, role)
values ('antonnoe@gmail.com', 'owner')
on conflict (email) do nothing;

-- --- Kanalen ---------------------------------------------------------
insert into distributie_kanalen (naam, type, zapier_hook, status)
values
  ('FB nederlanders.fr', 'facebook_page',    '', 'actief'),
  ('FB infofrankrijk',   'facebook_page',    '', 'actief'),
  ('LinkedIn Anton',     'linkedin_profile', '', 'actief')
on conflict do nothing;

-- --- Routes ----------------------------------------------------------
-- We koppelen routes aan kanalen op naam, zodat dit herhaalbaar is.
do $$
declare
  fb_nlfr uuid;
  fb_if   uuid;
  li      uuid;
begin
  select id into fb_nlfr from distributie_kanalen where naam = 'FB nederlanders.fr' limit 1;
  select id into fb_if   from distributie_kanalen where naam = 'FB infofrankrijk'   limit 1;
  select id into li      from distributie_kanalen where naam = 'LinkedIn Anton'     limit 1;

  -- nlfr → alle → FB nederlanders.fr
  if not exists (select 1 from distributie_routes where bron='nlfr' and match_type='alle' and kanaal_id=fb_nlfr) then
    insert into distributie_routes (bron, match_type, match_waarden, kanaal_id)
    values ('nlfr', 'alle', '{}', fb_nlfr);
  end if;

  -- nlfr → categorie_any {Midden- en Kleinbedrijf} → LinkedIn Anton
  if not exists (select 1 from distributie_routes where bron='nlfr' and match_type='categorie_any' and kanaal_id=li) then
    insert into distributie_routes (bron, match_type, match_waarden, kanaal_id)
    values ('nlfr', 'categorie_any', array['Midden- en Kleinbedrijf'], li);
  end if;

  -- if → alle → FB infofrankrijk
  if not exists (select 1 from distributie_routes where bron='if' and match_type='alle' and kanaal_id=fb_if) then
    insert into distributie_routes (bron, match_type, match_waarden, kanaal_id)
    values ('if', 'alle', '{}', fb_if);
  end if;

  -- if → categorie_any {Ondernemen, Midden- en Kleinbedrijf, Eigen baas – entrepreneur} → LinkedIn Anton
  if not exists (select 1 from distributie_routes where bron='if' and match_type='categorie_any' and kanaal_id=li) then
    insert into distributie_routes (bron, match_type, match_waarden, kanaal_id)
    values ('if', 'categorie_any',
            array['Ondernemen','Midden- en Kleinbedrijf','Eigen baas – entrepreneur'], li);
  end if;
end $$;

-- --- Instellingen: zet admin-email default ---------------------------
update distributie_instellingen
   set admin_email = coalesce(admin_email, 'antonnoe@gmail.com')
 where id = 1;
