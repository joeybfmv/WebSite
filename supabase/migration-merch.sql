-- migration-merch.sql — boutique merch (à exécuter UNE fois dans Supabase > SQL Editor)

create table if not exists public.merch_products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 2 and 160),
  description  text check (description is null or char_length(description) <= 2000),
  price        numeric(7,2) not null check (price >= 0),
  stock        integer check (stock is null or stock >= 0),            -- null = stock non suivi
  sale_mode    text not null default 'onsite' check (sale_mode in ('onsite', 'external', 'cart')),
  external_url text check (external_url is null or external_url ~* '^https?://'),
  images       text[] not null default '{}' check (cardinality(images) <= 6),
  position     integer,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (sale_mode <> 'external' or external_url is not null)
);
create index if not exists merch_products_pub_idx on public.merch_products (is_published, position);
drop trigger if exists merch_products_updated_at on public.merch_products;
create trigger merch_products_updated_at before update on public.merch_products
  for each row execute function public.set_updated_at();

alter table public.merch_products enable row level security;
drop policy if exists "merch_products_public_read" on public.merch_products;
create policy "merch_products_public_read" on public.merch_products
  for select to anon, authenticated using (is_published = true);
drop policy if exists "merch_products_admin_all" on public.merch_products;
create policy "merch_products_admin_all" on public.merch_products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Demandes de commande (panier). Aucun paiement en ligne : c'est une réservation.
create table if not exists public.merch_orders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 2 and 120),
  email      text not null check (char_length(email) <= 200 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'),
  message    text check (message is null or char_length(message) <= 1000),
  items      jsonb not null,
  total      numeric(8,2) not null default 0,
  status     text not null default 'new' check (status in ('new', 'confirmed', 'ready', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists merch_orders_created_idx on public.merch_orders (created_at desc);

-- Le serveur recalcule noms, prix et total depuis la table des produits (le navigateur n'est pas cru),
-- vérifie le stock et limite les abus (3 demandes/heure par e-mail, 30/heure au total).
create or replace function public.merch_orders_prepare()
returns trigger language plpgsql security definer set search_path = public as $$
declare it jsonb; p public.merch_products; q integer; res jsonb := '[]'::jsonb; tot numeric := 0;
begin
  if (select count(*) from public.merch_orders where lower(email) = lower(new.email) and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Trop de demandes pour cette adresse, réessayez plus tard.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.merch_orders where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Service momentanément saturé, réessayez plus tard.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(new.items) <> 'array' or jsonb_array_length(new.items) not between 1 and 30 then
    raise exception 'Panier invalide.' using errcode = 'P0001';
  end if;
  for it in select * from jsonb_array_elements(new.items) loop
    q := (it->>'qty')::integer;
    if q is null or q < 1 or q > 20 then raise exception 'Quantité invalide.' using errcode = 'P0001'; end if;
    select * into p from public.merch_products where id = (it->>'id')::uuid and is_published and sale_mode = 'cart';
    if not found then raise exception 'Un article du panier n''est plus disponible.' using errcode = 'P0001'; end if;
    if p.stock is not null and q > p.stock then raise exception 'Stock insuffisant pour « % ».', p.name using errcode = 'P0001'; end if;
    res := res || jsonb_build_object('id', p.id, 'name', p.name, 'price', p.price, 'qty', q);
    tot := tot + p.price * q;
  end loop;
  new.items := res; new.total := tot; new.status := 'new';
  return new;
end $$;
drop trigger if exists merch_orders_prepare on public.merch_orders;
create trigger merch_orders_prepare before insert on public.merch_orders
  for each row execute function public.merch_orders_prepare();

alter table public.merch_orders enable row level security;
drop policy if exists "merch_orders_public_insert" on public.merch_orders;
create policy "merch_orders_public_insert" on public.merch_orders
  for insert to anon, authenticated with check (status = 'new');
drop policy if exists "merch_orders_admin_select" on public.merch_orders;
create policy "merch_orders_admin_select" on public.merch_orders for select to authenticated using (public.is_admin());
drop policy if exists "merch_orders_admin_update" on public.merch_orders;
create policy "merch_orders_admin_update" on public.merch_orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "merch_orders_admin_delete" on public.merch_orders;
create policy "merch_orders_admin_delete" on public.merch_orders for delete to authenticated using (public.is_admin());
