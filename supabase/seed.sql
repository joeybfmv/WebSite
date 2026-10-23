-- seed.sql — à exécuter UNE fois dans Supabase > SQL Editor (après schema.sql)
insert into public.setlist (title, album, position) values
  ('Hit the Floor', null, 1),
  ('4 Words (To Choke Upon)', null, 2),
  ('Deliver Us from Evil', null, 3),
  ('Tears Don''t Fall', null, 4),
  ('Hearts Burst into Fire', null, 5),
  ('No More Tears To Cry', null, 6),
  ('Can''t Escape The Waves', null, 7),
  ('Your Betrayal', null, 8),
  ('Dirty Little Secret', null, 9),
  ('You Want a Battle? (Here''s a War)', null, 10),
  ('Cries in Vain', null, 11);

insert into public.gear (name, category, brand, model, description, position) values
  ('Harley Benton EX-84 Modern EMG BK', 'Guitare', 'Harley Benton', 'EX-84 Modern EMG BK', null, 1),
  ('Cort G110 Open Pore Black', 'Guitare', 'Cort', 'G110 Open Pore Black', null, 2);
