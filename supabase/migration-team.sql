-- migration-team.sql — espace équipe technique (fichiers privés, accès par connexion)
-- À exécuter UNE fois dans Supabase > SQL Editor.

create table if not exists public.team_members (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);
alter table public.team_members enable row level security;
drop policy if exists "team_members_read" on public.team_members;
create policy "team_members_read" on public.team_members
  for select to authenticated using (public.is_admin() or user_id = auth.uid());
-- Aucune écriture directe : uniquement via les fonctions ci-dessous (réservées aux administrateurs).

create or replace function public.is_team_member()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (public.is_admin() or exists (select 1 from public.team_members where user_id = auth.uid()));
$$;
revoke all on function public.is_team_member() from public, anon;
grant execute on function public.is_team_member() to authenticated;

create or replace function public.team_add_member(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  select id into uid from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
  if uid is null then raise exception 'Aucun compte avec cette adresse : crée-le d''abord dans Supabase (Authentication > Users).'; end if;
  insert into public.team_members (user_id, email) values (uid, lower(btrim(p_email))) on conflict (user_id) do nothing;
end $$;
revoke all on function public.team_add_member(text) from public, anon;
grant execute on function public.team_add_member(text) to authenticated;

create or replace function public.team_remove_member(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  delete from public.team_members where user_id = p_user;
end $$;
revoke all on function public.team_remove_member(uuid) from public, anon;
grant execute on function public.team_remove_member(uuid) to authenticated;

-- Dossier de fichiers PRIVÉ (jamais d'adresse publique)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-files', 'team-files', false, 52428800,
        array['image/png', 'image/jpeg', 'application/pdf', 'application/zip', 'application/x-zip-compressed'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "team_files_read" on storage.objects;
create policy "team_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'team-files' and public.is_team_member());
drop policy if exists "team_files_insert" on storage.objects;
create policy "team_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'team-files' and public.is_admin());
drop policy if exists "team_files_update" on storage.objects;
create policy "team_files_update" on storage.objects for update to authenticated
  using (bucket_id = 'team-files' and public.is_admin()) with check (bucket_id = 'team-files' and public.is_admin());
drop policy if exists "team_files_delete" on storage.objects;
create policy "team_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'team-files' and public.is_admin());
