-- =====================================================================
-- ExpiryGuard sample data (FINAL version)
-- Run AFTER schema.sql (SQL Editor → New query → paste → Run).
-- Dates are relative to today, so the dashboard always shows
-- expired, 30, 60, 90-day and safe stock. Safe to run more than once.
-- =====================================================================

-- Seed data includes EXPIRED batches on purpose, so switch off the
-- "no past expiry" trigger while inserting, then switch it back on.
alter table public.batches disable trigger check_batch_expiry;

-- Suppliers (return window = how many days before expiry they accept returns)
insert into public.suppliers (name, contact_person, phone, email, address, return_window_days) values
  ('Mehran Pharma Distributors', 'Ahmed Raza',   '03001234567', 'orders@mehranpharma.example.com', 'Saddar, Karachi',        30),
  ('Punjab Medical Traders',     'Sana Malik',   '03211234567', 'sales@punjabmedical.example.com', 'Urdu Bazar, Lahore',     60),
  ('Capital Health Supplies',    'Bilal Khan',   '03331234567', 'info@capitalhealth.example.com',  'Blue Area, Islamabad',   45)
on conflict (name) do nothing;

-- Medicines (barcode = what a barcode scanner types at checkout)
insert into public.medicines (brand_name, generic_name, strength, dosage_form, category, rack_location, min_stock_level, barcode) values
  ('Panadol',  'Paracetamol',                   '500 mg',      'tablet',  'Analgesic',        'A-1', 100, '8964000100011'),
  ('Augmentin','Amoxicillin + Clavulanic acid', '625 mg',      'tablet',  'Antibiotic',       'B-2', 40,  '8964000100028'),
  ('Brufen',   'Ibuprofen',                     '400 mg',      'tablet',  'Analgesic',        'A-2', 60,  '8964000100035'),
  ('Risek',    'Omeprazole',                    '20 mg',       'capsule', 'Gastrointestinal', 'C-1', 50,  '8964000100042'),
  ('Calpol',   'Paracetamol',                   '120 mg/5 ml', 'syrup',   'Antipyretic',      'D-1', 30,  '8964000100059'),
  ('Flagyl',   'Metronidazole',                 '400 mg',      'tablet',  'Antibiotic',       'B-3', 40,  '8964000100066'),
  ('Ventolin', 'Salbutamol',                    '100 mcg',     'inhaler', 'Respiratory',      'E-1', 10,  '8964000100073'),
  ('Softin',   'Loratadine',                    '10 mg',       'tablet',  'Antihistamine',    'A-4', 30,  '8964000100080')
on conflict (brand_name, strength, dosage_form) do nothing;

-- Medicines added by the older (40%) seed have no barcode yet – give them one.
update public.medicines m
   set barcode = v.barcode
  from (values ('Panadol', '500 mg', '8964000100011'), ('Augmentin', '625 mg', '8964000100028'), ('Brufen', '400 mg', '8964000100035'),
               ('Risek', '20 mg', '8964000100042'), ('Calpol', '120 mg/5 ml', '8964000100059'), ('Flagyl', '400 mg', '8964000100066'),
               ('Ventolin', '100 mcg', '8964000100073'), ('Softin', '10 mg', '8964000100080')) as v(brand, strength, barcode)
 where m.brand_name = v.brand and m.strength = v.strength and m.barcode is null
   and not exists (select 1 from public.medicines x where x.barcode = v.barcode);

-- Batches: (brand, batch no, supplier, days until expiry, quantity, purchase price, sale price)
insert into public.batches (medicine_id, supplier_id, batch_no, expiry_date, quantity, purchase_price, sale_price)
select m.id, s.id, v.batch_no, public.pk_today() + v.days, v.qty, v.buy, v.sell
from (values
  ('Panadol',   'PN-2401', 'Mehran Pharma Distributors', -15, 40,  1.80,  2.50),  -- expired → quarantine
  ('Panadol',   'PN-2409', 'Mehran Pharma Distributors',  20, 120, 1.80,  2.50),  -- 30 days
  ('Panadol',   'PN-2503', 'Mehran Pharma Distributors', 400, 300, 1.85,  2.60),  -- safe
  ('Augmentin', 'AG-2407', 'Mehran Pharma Distributors',  45, 120, 38.00, 45.00), -- proposal example: 120 left, 2/day, 45 days → 30 at risk
  ('Brufen',    'BR-2405', 'Capital Health Supplies',     -5, 25,  4.20,  5.50),  -- expired → quarantine
  ('Brufen',    'BR-2412', 'Capital Health Supplies',     80, 90,  4.20,  5.50),  -- 90 days
  ('Risek',     'RS-2410', 'Punjab Medical Traders',      28, 35,  14.00, 18.00), -- 30 days (low stock, return deadline passed)
  ('Calpol',    'CP-2408', 'Mehran Pharma Distributors',  35, 24,  95.00, 120.00),-- 60 days (low stock, return deadline in 5 days)
  ('Flagyl',    'FG-2502', 'Capital Health Supplies',    250, 80,  3.10,  4.00),  -- safe
  ('Ventolin',  'VT-2411', 'Punjab Medical Traders',      88, 6,   480.00, 560.00) -- 90 days (low stock)
  -- Softin has no batches → shows as low stock (out of stock)
) as v(brand, batch_no, supplier, days, qty, buy, sell)
join public.medicines m on m.brand_name = v.brand
join public.suppliers s on s.name = v.supplier
on conflict (medicine_id, batch_no) do nothing;

-- Switch the FR-03 check back on.
alter table public.batches enable trigger check_batch_expiry;

-- Sales history for the last 60 days, so the risk forecast (FR-09, FR-10) has data.
-- (Only added once – skipped if there are already sales.)
-- Average sales per day: Panadol 6 · Augmentin 2 · Brufen 1.5 · Risek 1 · Calpol 0.33 · Flagyl 0.5 · Ventolin 0.1
-- These are past sales, so they do not reduce the batch quantities above (those are today's stock).
do $$
declare
  d       int;
  v_sale  bigint;
  r       record;
begin
  if exists (select 1 from public.sales) then
    return;
  end if;

  for d in 1..60 loop
    insert into public.sales (cashier_name, sold_at, total)
    values ('Sample data', now() - make_interval(days => d), 0)
    returning id into v_sale;

    for r in
      select m.id as medicine_id, v.qty, v.every_n_days,
             (select b.id from public.batches b where b.medicine_id = m.id order by b.expiry_date desc limit 1) as batch_id,
             (select b.sale_price from public.batches b where b.medicine_id = m.id order by b.expiry_date desc limit 1) as price
      from (values ('Panadol', 6, 1), ('Augmentin', 2, 1), ('Brufen', 3, 2), ('Risek', 1, 1),
                   ('Calpol', 1, 3), ('Flagyl', 1, 2), ('Ventolin', 1, 10)) as v(brand, qty, every_n_days)
      join public.medicines m on m.brand_name = v.brand
    loop
      if d % r.every_n_days = 0 and r.batch_id is not null then
        insert into public.sale_items (sale_id, batch_id, medicine_id, quantity, unit_price, sold_on)
        values (v_sale, r.batch_id, r.medicine_id, r.qty, r.price, public.pk_today() - d);
      end if;
    end loop;

    update public.sales
       set total = (select coalesce(sum(quantity * unit_price), 0) from public.sale_items where sale_id = v_sale)
     where id = v_sale;
  end loop;
end $$;
