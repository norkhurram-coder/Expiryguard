-- =====================================================================
-- ExpiryGuard database script (40% milestone)
-- Paste ALL of this into Supabase → SQL Editor → New query → Run.
-- Safe to run again: it only creates things that don't exist yet
-- and replaces functions/policies. It does not delete your data.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PROFILES  (one row per user, linked to Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (full_name ~ '^[A-Za-z ]{2,50}$'),
  age         int  check (age between 18 and 70),
  phone       text check (phone ~ '^03[0-9]{9}$'),
  role        text not null default 'sales_staff'
              check (role in ('admin', 'pharmacist', 'sales_staff')),
  created_at  timestamptz not null default now()
);

-- When someone signs up, copy the details from the sign-up form into profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, age, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'New User'),
    nullif(new.raw_user_meta_data ->> 'age', '')::int,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    case
      when new.raw_user_meta_data ->> 'role' in ('admin', 'pharmacist', 'sales_staff')
        then new.raw_user_meta_data ->> 'role'
      else 'sales_staff'
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- 2. SUPPLIERS  (FR-11: each supplier has a return window in days)
-- ---------------------------------------------------------------------
create table if not exists public.suppliers (
  id                  bigint generated always as identity primary key,
  name                text not null unique check (char_length(trim(name)) between 2 and 100),
  contact_person      text not null check (contact_person ~ '^[A-Za-z ]{2,50}$'),
  phone               text not null check (phone ~ '^03[0-9]{9}$'),
  email               text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address             text check (address is null or char_length(address) <= 200),
  return_window_days  int  not null default 0 check (return_window_days between 0 and 365),
  created_at          timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 3. MEDICINES  (FR-01)
-- ---------------------------------------------------------------------
create table if not exists public.medicines (
  id               bigint generated always as identity primary key,
  brand_name       text not null check (char_length(trim(brand_name)) between 2 and 100),
  generic_name     text not null check (char_length(trim(generic_name)) between 2 and 100),
  strength         text not null check (char_length(trim(strength)) between 1 and 30),
  dosage_form      text not null check (dosage_form in
                     ('tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'other')),
  category         text not null check (category in
                     ('Analgesic', 'Antibiotic', 'Antipyretic', 'Gastrointestinal', 'Antihistamine',
                      'Cardiovascular', 'Antidiabetic', 'Respiratory', 'Dermatological',
                      'Vitamin & Supplement', 'Other')),
  rack_location    text check (rack_location is null or rack_location ~ '^[A-Za-z0-9-]{1,20}$'),
  min_stock_level  int  not null default 10 check (min_stock_level between 0 and 10000),
  created_at       timestamptz not null default now(),
  unique (brand_name, strength, dosage_form)
);


-- ---------------------------------------------------------------------
-- 4. BATCHES  (FR-02: stock is recorded per batch with its own expiry date)
-- ---------------------------------------------------------------------
create table if not exists public.batches (
  id              bigint generated always as identity primary key,
  medicine_id     bigint not null references public.medicines (id) on delete restrict,
  supplier_id     bigint not null references public.suppliers (id) on delete restrict,
  batch_no        text   not null check (batch_no ~ '^[A-Za-z0-9-]{2,30}$'),
  expiry_date     date   not null,
  quantity        int    not null check (quantity between 0 and 100000),
  purchase_price  numeric(10, 2) not null check (purchase_price > 0),
  sale_price      numeric(10, 2) not null check (sale_price > 0),
  created_at      timestamptz not null default now(),
  unique (medicine_id, batch_no)
);

create index if not exists batches_expiry_idx on public.batches (expiry_date);

-- FR-03: reject a batch whose expiry date is today or in the past.
-- (Only checked when the date is entered or changed, so old batches can still be edited/deleted.)
create or replace function public.reject_past_expiry()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.expiry_date is distinct from old.expiry_date then
    if new.expiry_date <= current_date then
      raise exception 'Expiry date must be after today. Expired stock cannot be added.';
    end if;
    if new.expiry_date > current_date + interval '10 years' then
      raise exception 'Expiry date must be within 10 years.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists check_batch_expiry on public.batches;
create trigger check_batch_expiry
  before insert or update on public.batches
  for each row execute function public.reject_past_expiry();


-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- Rule of thumb: RLS ON + no policy = the table looks EMPTY to the app.
-- ---------------------------------------------------------------------

-- Helper: returns the role of the logged-in user ('admin', 'pharmacist' or 'sales_staff').
-- "security definer" lets it read profiles without being blocked by RLS itself.
create or replace function public.get_my_role()
returns text
language sql
stable
security definer set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

alter table public.profiles  enable row level security;
alter table public.suppliers enable row level security;
alter table public.medicines enable row level security;
alter table public.batches   enable row level security;

-- PROFILES: you can see your own profile; Admin can see and edit everyone's.
drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.get_my_role() = 'admin');

drop policy if exists "profiles: admin updates" on public.profiles;
create policy "profiles: admin updates" on public.profiles
  for update to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- SUPPLIERS: Admin + Pharmacist can view, add and edit. Only Admin can delete.
-- Sales Staff cannot see suppliers at all.
drop policy if exists "suppliers: view" on public.suppliers;
create policy "suppliers: view" on public.suppliers
  for select to authenticated
  using (public.get_my_role() in ('admin', 'pharmacist'));

drop policy if exists "suppliers: add" on public.suppliers;
create policy "suppliers: add" on public.suppliers
  for insert to authenticated
  with check (public.get_my_role() in ('admin', 'pharmacist'));

drop policy if exists "suppliers: edit" on public.suppliers;
create policy "suppliers: edit" on public.suppliers
  for update to authenticated
  using (public.get_my_role() in ('admin', 'pharmacist'))
  with check (public.get_my_role() in ('admin', 'pharmacist'));

drop policy if exists "suppliers: delete" on public.suppliers;
create policy "suppliers: delete" on public.suppliers
  for delete to authenticated
  using (public.get_my_role() = 'admin');

-- MEDICINES: everyone (incl. Sales Staff) can view. Admin + Pharmacist add/edit. Admin deletes.
drop policy if exists "medicines: view" on public.medicines;
create policy "medicines: view" on public.medicines
  for select to authenticated
  using (public.get_my_role() in ('admin', 'pharmacist', 'sales_staff'));

drop policy if exists "medicines: add" on public.medicines;
create policy "medicines: add" on public.medicines
  for insert to authenticated
  with check (public.get_my_role() in ('admin', 'pharmacist'));

drop policy if exists "medicines: edit" on public.medicines;
create policy "medicines: edit" on public.medicines
  for update to authenticated
  using (public.get_my_role() in ('admin', 'pharmacist'))
  with check (public.get_my_role() in ('admin', 'pharmacist'));

drop policy if exists "medicines: delete" on public.medicines;
create policy "medicines: delete" on public.medicines
  for delete to authenticated
  using (public.get_my_role() = 'admin');

-- BATCHES: same rules as medicines.
drop policy if exists "batches: view" on public.batches;
create policy "batches: view" on public.batches
  for select to authenticated
  using (public.get_my_role() in ('admin', 'pharmacist', 'sales_staff'));

drop policy if exists "batches: add" on public.batches;
create policy "batches: add" on public.batches
  for insert to authenticated
  with check (public.get_my_role() in ('admin', 'pharmacist'));

drop policy if exists "batches: edit" on public.batches;
create policy "batches: edit" on public.batches
  for update to authenticated
  using (public.get_my_role() in ('admin', 'pharmacist'))
  with check (public.get_my_role() in ('admin', 'pharmacist'));

drop policy if exists "batches: delete" on public.batches;
create policy "batches: delete" on public.batches
  for delete to authenticated
  using (public.get_my_role() = 'admin');

-- Table permissions for logged-in users (RLS above still decides which rows).
grant select, insert, update, delete on public.suppliers, public.medicines, public.batches to authenticated;
grant select, update on public.profiles to authenticated;
