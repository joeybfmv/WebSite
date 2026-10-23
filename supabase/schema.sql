-- =====================================================================
-- supabase/schema.sql — Joɘy, Tribute BFMV
-- À exécuter UNE FOIS dans Supabase > SQL Editor (rôle postgres).
-- Ré-exécutable sans danger (IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- Choix de conception :
--  * Les droits d'écriture sont réservés aux comptes listés dans la table
--    public.admins (et non à « tout utilisateur connecté »), afin qu'une
--    inscription accidentellement ouverte ne donne aucun pouvoir.
--  * Le public ne lit que les lignes is_published = true.
--  * contact_requests : insertion publique contrôlée, AUCUNE lecture publique.
--  * Aucune clé service_role n'est nécessaire côté navigateur.
-- =====================================================================

-- ---------- Utilitaires ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- Administrateurs ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "admins_select_self" on public.admins;
create policy "admins_select_self" on public.admins
  for select to authenticated using (user_id = auth.uid());
-- Aucune policy d'écriture : les admins s'ajoutent uniquement depuis le SQL Editor.

-- ---------- Concerts ----------
create table if not exists public.concerts (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(title) between 2 and 160),
  description     text check (description is null or char_length(description) <= 2000),
  event_date      timestamptz not null,
  venue_name      text check (venue_name is null or char_length(venue_name) <= 160),
  address         text check (address is null or char_length(address) <= 300),
  city            text check (city is null or char_length(city) <= 120),
  latitude        numeric(9,6) check (latitude  between -90  and 90),
  longitude       numeric(9,6) check (longitude between -180 and 180),
  poster_url      text check (poster_url is null or poster_url ~* '^https?://'),
  reservation_url text check (reservation_url is null or reservation_url ~* '^https?://'),
  price_type      text not null default 'none' check (price_type in ('none', 'free', 'paid', 'amount')),
  price_amount    numeric(7,2) check (price_amount is null or price_amount >= 0),
  is_published    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists concerts_pub_date_idx on public.concerts (is_published, event_date);
drop trigger if exists concerts_updated_at on public.concerts;
create trigger concerts_updated_at before update on public.concerts
  for each row execute function public.set_updated_at();

alter table public.concerts enable row level security;
drop policy if exists "concerts_public_read" on public.concerts;
create policy "concerts_public_read" on public.concerts
  for select to anon, authenticated using (is_published = true);
drop policy if exists "concerts_admin_all" on public.concerts;
create policy "concerts_admin_all" on public.concerts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Setlist ----------
create table if not exists public.setlist (
  id               bigint generated always as identity primary key,
  title            text not null check (char_length(title) between 1 and 160),
  album            text check (album is null or char_length(album) <= 160),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 3600),
  position         integer,
  is_published     boolean not null default true
);
create index if not exists setlist_pub_pos_idx on public.setlist (is_published, position);

alter table public.setlist enable row level security;
drop policy if exists "setlist_public_read" on public.setlist;
create policy "setlist_public_read" on public.setlist
  for select to anon, authenticated using (is_published = true);
drop policy if exists "setlist_admin_all" on public.setlist;
create policy "setlist_admin_all" on public.setlist
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Matériel ----------
create table if not exists public.gear (
  id           bigint generated always as identity primary key,
  name         text not null check (char_length(name) between 1 and 160),
  category     text check (category is null or char_length(category) <= 80),
  brand        text check (brand is null or char_length(brand) <= 80),
  model        text check (model is null or char_length(model) <= 120),
  description  text check (description is null or char_length(description) <= 1000),
  image_url    text check (image_url is null or image_url ~* '^https?://'),
  position     integer,
  is_published boolean not null default true
);
create index if not exists gear_pub_pos_idx on public.gear (is_published, position);

alter table public.gear enable row level security;
drop policy if exists "gear_public_read" on public.gear;
create policy "gear_public_read" on public.gear
  for select to anon, authenticated using (is_published = true);
drop policy if exists "gear_admin_all" on public.gear;
create policy "gear_admin_all" on public.gear
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Demandes de contact ----------
create table if not exists public.contact_requests (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 2 and 120),
  email        text not null check (char_length(email) <= 200 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'),
  organization text check (organization is null or char_length(organization) <= 160),
  event_date   date,
  city         text check (city is null or char_length(city) <= 120),
  message      text not null check (char_length(btrim(message)) between 10 and 2000),
  created_at   timestamptz not null default now(),
  status       text not null default 'new' check (status in ('new', 'read', 'replied', 'archived'))
);
create index if not exists contact_requests_created_idx on public.contact_requests (created_at desc);
create index if not exists contact_requests_email_idx on public.contact_requests (lower(email), created_at desc);

-- Limitation d'abus côté serveur : 3 demandes/heure par e-mail, 30/heure au total.
create or replace function public.contact_requests_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.contact_requests
       where lower(email) = lower(new.email) and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Trop de demandes pour cette adresse, réessayez plus tard.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.contact_requests
       where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Service momentanément saturé, réessayez plus tard.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists contact_requests_rate_limit on public.contact_requests;
create trigger contact_requests_rate_limit before insert on public.contact_requests
  for each row execute function public.contact_requests_rate_limit();

alter table public.contact_requests enable row level security;

-- Insertion publique : seulement une demande « new » (impossible de forger status/created_at).
drop policy if exists "contact_public_insert" on public.contact_requests;
create policy "contact_public_insert" on public.contact_requests
  for insert to anon, authenticated
  with check (status = 'new' and created_at > now() - interval '1 minute');
-- Lecture / modification / suppression : administrateurs uniquement.
drop policy if exists "contact_admin_select" on public.contact_requests;
create policy "contact_admin_select" on public.contact_requests
  for select to authenticated using (public.is_admin());
drop policy if exists "contact_admin_update" on public.contact_requests;
create policy "contact_admin_update" on public.contact_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "contact_admin_delete" on public.contact_requests;
create policy "contact_admin_delete" on public.contact_requests
  for delete to authenticated using (public.is_admin());

-- Défense en profondeur : le rôle anon n'a aucun droit de lecture/modif sur les messages.
revoke all on public.contact_requests from anon;
grant insert on public.contact_requests to anon;
revoke all on public.admins from anon;

-- ---------- Storage : affiches et images ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posters', 'posters', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lecture publique via l'URL publique du bucket ; écriture réservée aux admins.
drop policy if exists "posters_admin_insert" on storage.objects;
create policy "posters_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'posters' and public.is_admin());
drop policy if exists "posters_admin_update" on storage.objects;
create policy "posters_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'posters' and public.is_admin()) with check (bucket_id = 'posters' and public.is_admin());
drop policy if exists "posters_admin_delete" on storage.objects;
create policy "posters_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'posters' and public.is_admin());
drop policy if exists "posters_admin_select" on storage.objects;
create policy "posters_admin_select" on storage.objects
  for select to authenticated using (bucket_id = 'posters' and public.is_admin());

-- =====================================================================
-- ÉTAPE MANUELLE : déclarer votre compte administrateur
-- 1) Authentication > Users > « Add user » (e-mail + mot de passe, cochez « Auto Confirm User »)
-- 2) Exécutez, en remplaçant l'e-mail :
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'votre-email@exemple.fr';
--
-- 3) Authentication > Providers > Email : DÉSACTIVEZ « Allow new users to sign up ».
-- =====================================================================

-- ---------- Données de démonstration (OPTIONNEL — à supprimer avant la mise en ligne) ----------
-- insert into public.setlist (title, album, position) values
--   ('[DÉMO] Titre exemple', 'Album exemple', 1);
