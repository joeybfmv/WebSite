-- migration-admin-v2.sql — à exécuter UNE fois dans Supabase > SQL Editor (base déjà créée avec schema.sql)
alter table public.concerts add column if not exists price_type text not null default 'none'
  check (price_type in ('none', 'free', 'paid', 'amount'));
alter table public.concerts add column if not exists price_amount numeric(7,2)
  check (price_amount is null or price_amount >= 0);
