-- =====================================================================
-- ExpiryGuard sample data
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

-- Medicines
insert into public.medicines (brand_name, generic_name, strength, dosage_form, category, rack_location, min_stock_level) values
  ('Panadol',  'Paracetamol',                   '500 mg',      'tablet',  'Analgesic',        'A-1', 100),
  ('Augmentin','Amoxicillin + Clavulanic acid', '625 mg',      'tablet',  'Antibiotic',       'B-2', 40),
  ('Brufen',   'Ibuprofen',                     '400 mg',      'tablet',  'Analgesic',        'A-2', 60),
  ('Risek',    'Omeprazole',                    '20 mg',       'capsule', 'Gastrointestinal', 'C-1', 50),
  ('Calpol',   'Paracetamol',                   '120 mg/5 ml', 'syrup',   'Antipyretic',      'D-1', 30),
  ('Flagyl',   'Metronidazole',                 '400 mg',      'tablet',  'Antibiotic',       'B-3', 40),
  ('Ventolin', 'Salbutamol',                    '100 mcg',     'inhaler', 'Respiratory',      'E-1', 10),
  ('Softin',   'Loratadine',                    '10 mg',       'tablet',  'Antihistamine',    'A-4', 30)
on conflict (brand_name, strength, dosage_form) do nothing;

-- Batches: (brand, batch no, supplier, days until expiry, quantity, purchase price, sale price)
insert into public.batches (medicine_id, supplier_id, batch_no, expiry_date, quantity, purchase_price, sale_price)
select m.id, s.id, v.batch_no, current_date + v.days, v.qty, v.buy, v.sell
from (values
  ('Panadol',   'PN-2401', 'Mehran Pharma Distributors', -15, 40,  1.80,  2.50),  -- expired
  ('Panadol',   'PN-2409', 'Mehran Pharma Distributors',  20, 120, 1.80,  2.50),  -- 30 days
  ('Panadol',   'PN-2503', 'Mehran Pharma Distributors', 400, 300, 1.85,  2.60),  -- safe
  ('Augmentin', 'AG-2407', 'Punjab Medical Traders',      45, 30,  38.00, 45.00), -- 60 days
  ('Brufen',    'BR-2405', 'Capital Health Supplies',     -5, 25,  4.20,  5.50),  -- expired
  ('Brufen',    'BR-2412', 'Capital Health Supplies',     80, 90,  4.20,  5.50),  -- 90 days
  ('Risek',     'RS-2410', 'Punjab Medical Traders',      28, 35,  14.00, 18.00), -- 30 days (low stock)
  ('Calpol',    'CP-2408', 'Mehran Pharma Distributors',  58, 24,  95.00, 120.00),-- 60 days (low stock)
  ('Flagyl',    'FG-2502', 'Capital Health Supplies',    250, 80,  3.10,  4.00),  -- safe
  ('Ventolin',  'VT-2411', 'Punjab Medical Traders',      88, 6,   480.00, 560.00) -- 90 days (low stock)
  -- Softin has no batches → shows as low stock (out of stock)
) as v(brand, batch_no, supplier, days, qty, buy, sell)
join public.medicines m on m.brand_name = v.brand
join public.suppliers s on s.name = v.supplier
on conflict (medicine_id, batch_no) do nothing;

-- Switch the FR-03 check back on.
alter table public.batches enable trigger check_batch_expiry;
