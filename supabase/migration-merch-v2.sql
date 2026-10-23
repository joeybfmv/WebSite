-- migration-merch-v2.sql — variantes, badges, paiement en ligne, stock automatique
-- À exécuter UNE fois dans Supabase > SQL Editor, APRÈS migration-merch.sql.

-- ---------- Produits : variantes (tailles, couleurs…) et badge ----------
alter table public.merch_products add column if not exists options jsonb not null default '[]'::jsonb;
alter table public.merch_products drop constraint if exists merch_products_options_check;
alter table public.merch_products add constraint merch_products_options_check
  check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 20);
alter table public.merch_products add column if not exists badge text not null default 'auto';
alter table public.merch_products drop constraint if exists merch_products_badge_check;
alter table public.merch_products add constraint merch_products_badge_check check (badge in ('auto', 'new', 'last', 'none'));
-- options = [{"label": "M", "stock": 8}, {"label": "L", "stock": null}]  (stock null = non suivi)

-- ---------- Commandes : paiement en ligne + stock ----------
alter table public.merch_orders drop constraint if exists merch_orders_status_check;
alter table public.merch_orders add constraint merch_orders_status_check
  check (status in ('pending_payment', 'new', 'paid', 'confirmed', 'ready', 'done', 'cancelled'));
alter table public.merch_orders add column if not exists payment_method text not null default 'reservation' check (payment_method in ('reservation', 'online'));
alter table public.merch_orders add column if not exists stripe_session_id text;
alter table public.merch_orders add column if not exists paid_at timestamptz;
alter table public.merch_orders add column if not exists stock_applied boolean not null default false;

-- Ajuste le stock d'une ligne de commande (delta = -1 : retirer, +1 : remettre).
create or replace function public.merch_adjust_stock(item jsonb, delta integer)
returns void language plpgsql security definer set search_path = public as $$
declare pid uuid := (item->>'id')::uuid; lbl text := nullif(item->>'variant', ''); q integer := (item->>'qty')::integer;
begin
  if lbl is not null then
    update public.merch_products set options = (
      select coalesce(jsonb_agg(
        case when o->>'label' = lbl and jsonb_typeof(o->'stock') = 'number'
             then jsonb_set(o, '{stock}', to_jsonb(greatest((o->>'stock')::integer + delta * q, 0)))
             else o end order by ord), '[]'::jsonb)
      from jsonb_array_elements(options) with ordinality as t(o, ord)) where id = pid;
  else
    update public.merch_products set stock = greatest(stock + delta * q, 0) where id = pid and stock is not null;
  end if;
end $$;
revoke all on function public.merch_adjust_stock(jsonb, integer) from public, anon, authenticated;

-- Préparation d'une commande : le serveur recalcule noms, prix, variantes et total ; vérifie le stock.
create or replace function public.merch_orders_prepare()
returns trigger language plpgsql security definer set search_path = public as $$
declare it jsonb; p public.merch_products; q integer; v text; opt jsonb; res jsonb := '[]'::jsonb; tot numeric := 0;
begin
  if (select count(*) from public.merch_orders where lower(email) = lower(new.email) and created_at > now() - interval '1 hour') >= 6 then
    raise exception 'Trop de demandes pour cette adresse, réessayez plus tard.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.merch_orders where created_at > now() - interval '1 hour') >= 40 then
    raise exception 'Service momentanément saturé, réessayez plus tard.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(new.items) <> 'array' or jsonb_array_length(new.items) not between 1 and 30 then
    raise exception 'Panier invalide.' using errcode = 'P0001';
  end if;
  for it in select * from jsonb_array_elements(new.items) loop
    q := (it->>'qty')::integer;
    v := nullif(btrim(coalesce(it->>'variant', '')), '');
    if q is null or q < 1 or q > 20 then raise exception 'Quantité invalide.' using errcode = 'P0001'; end if;
    select * into p from public.merch_products where id = (it->>'id')::uuid and is_published and sale_mode = 'cart';
    if not found then raise exception 'Un article du panier n''est plus disponible.' using errcode = 'P0001'; end if;
    if jsonb_array_length(p.options) > 0 then
      if v is null then raise exception 'Choisissez une variante pour « % ».', p.name using errcode = 'P0001'; end if;
      select o into opt from jsonb_array_elements(p.options) as t(o) where o->>'label' = v limit 1;
      if opt is null then raise exception 'Variante indisponible pour « % ».', p.name using errcode = 'P0001'; end if;
      if jsonb_typeof(opt->'stock') = 'number' and q > (opt->>'stock')::integer then
        raise exception 'Stock insuffisant pour « % » (%).', p.name, v using errcode = 'P0001';
      end if;
    else
      v := null;
      if p.stock is not null and q > p.stock then raise exception 'Stock insuffisant pour « % ».', p.name using errcode = 'P0001'; end if;
    end if;
    res := res || jsonb_build_object('id', p.id, 'name', p.name, 'variant', v, 'price', p.price, 'qty', q);
    tot := tot + p.price * q;
  end loop;
  new.items := res; new.total := tot;
  -- Un visiteur ne peut créer qu'une demande « new » ; seule la fonction serveur (service_role) crée des commandes à payer.
  if auth.role() is distinct from 'service_role' then
    new.status := 'new'; new.payment_method := 'reservation'; new.stripe_session_id := null; new.paid_at := null; new.stock_applied := false;
  end if;
  return new;
end $$;

-- Stock automatique : retiré quand la commande devient payée/confirmée, remis si elle est annulée.
create or replace function public.merch_orders_stock_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare it jsonb; want boolean := new.status in ('paid', 'confirmed', 'ready', 'done');
begin
  if want and not old.stock_applied then
    for it in select * from jsonb_array_elements(new.items) loop perform public.merch_adjust_stock(it, -1); end loop;
    new.stock_applied := true;
  elsif not want and old.stock_applied then
    for it in select * from jsonb_array_elements(new.items) loop perform public.merch_adjust_stock(it, 1); end loop;
    new.stock_applied := false;
  end if;
  return new;
end $$;
drop trigger if exists merch_orders_stock_sync on public.merch_orders;
create trigger merch_orders_stock_sync before update on public.merch_orders
  for each row execute function public.merch_orders_stock_sync();
