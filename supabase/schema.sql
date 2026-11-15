-- =====================================================================
-- ExpiryGuard database script (FINAL version)
-- Paste ALL of this into Supabase → SQL Editor → New query → Run.
-- Safe to run again: it only creates things that don't exist yet
-- and replaces functions/policies. It does not delete your data.
-- (If you already ran the 40% version, just run this file again.)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. HELPER: today's date in Pakistan time (the database runs in UTC)
-- ---------------------------------------------------------------------
create or replace function public.pk_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Karachi')::date;
$$;


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

-- Final version: keep the email too, so the Admin can see who is who on the Users page.
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

-- When someone signs up, copy the details from the sign-up form into profiles.
-- FR-16 / security: users can NOT choose their own role any more.
--   • If there is no Admin yet, the new user becomes the Admin (the pharmacy owner).
--   • Everyone else starts as Sales Staff, and the Admin promotes them on the Users page.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, age, phone, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'New User'),
    nullif(new.raw_user_meta_data ->> 'age', '')::int,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    case
      when not exists (select 1 from public.profiles where role = 'admin') then 'admin'
      else 'sales_staff'
    end,
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Never allow the last Admin to be demoted (otherwise nobody could manage roles).
create or replace function public.keep_one_admin()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if old.role = 'admin' and new.role <> 'admin'
     and not exists (select 1 from public.profiles where role = 'admin' and id <> old.id) then
    raise exception 'There must always be at least one Admin.';
  end if;
  return new;
end;
$$;

drop trigger if exists keep_one_admin on public.profiles;
create trigger keep_one_admin
  before update of role on public.profiles
  for each row execute function public.keep_one_admin();


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

-- NFR-05: optional barcode so a barcode scanner can add items at checkout.
alter table public.medicines add column if not exists barcode text unique
  check (barcode is null or barcode ~ '^[0-9A-Za-z-]{4,30}$');


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
-- NFR-01: FEFO lookup at checkout = "batches of this medicine, earliest expiry first".
create index if not exists batches_medicine_expiry_idx on public.batches (medicine_id, expiry_date);

-- FR-03: reject a batch whose expiry date is today or in the past.
-- (Only checked when the date is entered or changed, so old batches can still be edited/deleted.)
create or replace function public.reject_past_expiry()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.expiry_date is distinct from old.expiry_date then
    if new.expiry_date <= public.pk_today() then
      raise exception 'Expiry date must be after today. Expired stock cannot be added.';
    end if;
    if new.expiry_date > public.pk_today() + interval '10 years' then
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
-- 5. SALES  (FR-04, FR-05, FR-06: checkout with FEFO and expired-sale block)
-- ---------------------------------------------------------------------
create table if not exists public.sales (
  id            bigint generated always as identity primary key,
  sold_by       uuid references public.profiles (id) on delete set null,
  cashier_name  text,
  sold_at       timestamptz not null default now(),
  total         numeric(12, 2) not null default 0 check (total >= 0)
);

create table if not exists public.sale_items (
  id           bigint generated always as identity primary key,
  sale_id      bigint not null references public.sales (id) on delete cascade,
  batch_id     bigint not null references public.batches (id) on delete restrict,
  medicine_id  bigint not null references public.medicines (id) on delete restrict,
  quantity     int    not null check (quantity > 0),
  unit_price   numeric(10, 2) not null check (unit_price > 0),
  sold_on      date   not null default public.pk_today()
);

create index if not exists sales_sold_at_idx on public.sales (sold_at);
-- FR-09: average daily sales = sales of one medicine over the last 60 days.
create index if not exists sale_items_medicine_date_idx on public.sale_items (medicine_id, sold_on);
create index if not exists sale_items_sale_idx on public.sale_items (sale_id);


-- ---------------------------------------------------------------------
-- 6. AUDIT LOG  (NFR-06: every stock change is logged with the user and time)
-- ---------------------------------------------------------------------
create table if not exists public.stock_movements (
  id               bigint generated always as identity primary key,
  batch_id         bigint,          -- no foreign key, so the history survives if a batch is deleted
  medicine_id      bigint,
  batch_no         text,
  expiry_date      date,
  movement         text not null check (movement in ('purchase', 'sale', 'adjustment', 'disposal', 'return', 'delete')),
  quantity_change  int  not null,
  unit_cost        numeric(10, 2),
  note             text,
  user_id          uuid,
  user_name        text,
  created_at       timestamptz not null default now()
);

create index if not exists stock_movements_created_idx on public.stock_movements (created_at desc);

-- Runs after every insert / update / delete on batches and writes one audit row.
-- The kind of change ("sale", "disposal", "return") is passed in by the functions below
-- with set_config('expiryguard.movement', …); a normal edit is an "adjustment".
create or replace function public.log_stock_change()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text;
  v_kind text;
  v_note text;
begin
  select full_name into v_name from public.profiles where id = v_uid;

  if tg_op = 'INSERT' then
    insert into public.stock_movements
      (batch_id, medicine_id, batch_no, expiry_date, movement, quantity_change, unit_cost, note, user_id, user_name)
    values
      (new.id, new.medicine_id, new.batch_no, new.expiry_date, 'purchase', new.quantity, new.purchase_price,
       'New batch received', v_uid, v_name);
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.stock_movements
      (batch_id, medicine_id, batch_no, expiry_date, movement, quantity_change, unit_cost, note, user_id, user_name)
    values
      (old.id, old.medicine_id, old.batch_no, old.expiry_date, 'delete', -old.quantity, old.purchase_price,
       'Batch deleted', v_uid, v_name);
    return old;
  end if;

  -- UPDATE: only log real changes
  if new.quantity is distinct from old.quantity
     or new.expiry_date is distinct from old.expiry_date
     or new.batch_no is distinct from old.batch_no
     or new.purchase_price is distinct from old.purchase_price
     or new.sale_price is distinct from old.sale_price then

    v_kind := coalesce(nullif(current_setting('expiryguard.movement', true), ''), 'adjustment');
    v_note := nullif(current_setting('expiryguard.note', true), '');
    if v_note is null and v_kind = 'adjustment' then
      v_note := concat_ws('; ',
        case when new.quantity <> old.quantity then 'Quantity ' || old.quantity || ' → ' || new.quantity end,
        case when new.expiry_date <> old.expiry_date then 'Expiry ' || old.expiry_date || ' → ' || new.expiry_date end,
        case when new.batch_no <> old.batch_no then 'Batch no. ' || old.batch_no || ' → ' || new.batch_no end,
        case when new.purchase_price <> old.purchase_price or new.sale_price <> old.sale_price then 'Prices edited' end);
    end if;

    insert into public.stock_movements
      (batch_id, medicine_id, batch_no, expiry_date, movement, quantity_change, unit_cost, note, user_id, user_name)
    values
      (new.id, new.medicine_id, new.batch_no, new.expiry_date, v_kind, new.quantity - old.quantity, new.purchase_price,
       v_note, v_uid, v_name);
  end if;
  return new;
end;
$$;

drop trigger if exists log_stock_change on public.batches;
create trigger log_stock_change
  after insert or update or delete on public.batches
  for each row execute function public.log_stock_change();


-- ---------------------------------------------------------------------
-- 7. CHECKOUT FUNCTION  (FR-04 FEFO, FR-05 block expired, concurrency-safe)
--
-- p_items = [{"medicine_id": 1, "quantity": 3}, …]
-- For every medicine it takes stock from the earliest-expiring, NOT expired batch first,
-- moving on to the next batch if one isn't enough. Expired batches are never touched.
--
-- "FOR UPDATE" locks the batch rows while the sale is being saved. If two counters sell
-- the last packs at the same moment, the second one waits for the first to finish and
-- then sees the new quantity – so stock can never go below zero (no race condition).
-- The whole sale is one transaction: if any item fails, nothing is saved.
-- ---------------------------------------------------------------------
create or replace function public.process_sale(p_items jsonb)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_role     text := public.get_my_role();
  v_today    date := public.pk_today();
  v_sale_id  bigint;
  v_total    numeric(12, 2) := 0;
  v_lines    jsonb := '[]'::jsonb;
  v_item     jsonb;
  v_med_id   bigint;
  v_med_name text;
  v_need     int;
  v_take     int;
  v_batch    record;
begin
  if v_role is null then
    raise exception 'You must be logged in to make a sale.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'The cart is empty.';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'A sale can have at most 50 items.';
  end if;

  insert into public.sales (sold_by, cashier_name)
  values (auth.uid(), (select full_name from public.profiles where id = auth.uid()))
  returning id into v_sale_id;

  -- Tell the audit-log trigger that these quantity changes are sales.
  perform set_config('expiryguard.movement', 'sale', true);
  perform set_config('expiryguard.note', 'Sale #' || v_sale_id, true);

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_med_id := (v_item ->> 'medicine_id')::bigint;
    v_need   := (v_item ->> 'quantity')::int;

    select brand_name || ' ' || strength into v_med_name from public.medicines where id = v_med_id;
    if v_med_name is null then
      raise exception 'Medicine % was not found.', v_med_id;
    end if;
    if v_need is null or v_need < 1 or v_need > 10000 then
      raise exception 'Quantity for % must be between 1 and 10,000.', v_med_name;
    end if;

    for v_batch in
      select id, batch_no, quantity, sale_price, expiry_date
      from public.batches
      where medicine_id = v_med_id
        and quantity > 0
        and expiry_date > v_today          -- FR-05: expired stock is never sold
      order by expiry_date, id             -- FR-04: First-Expiry-First-Out
      for update                           -- lock: safe when two counters sell at once
    loop
      exit when v_need = 0;
      v_take := least(v_need, v_batch.quantity);

      update public.batches set quantity = quantity - v_take where id = v_batch.id;

      insert into public.sale_items (sale_id, batch_id, medicine_id, quantity, unit_price, sold_on)
      values (v_sale_id, v_batch.id, v_med_id, v_take, v_batch.sale_price, v_today);

      v_total := v_total + v_take * v_batch.sale_price;
      v_lines := v_lines || jsonb_build_object(
        'medicine', v_med_name, 'batch_no', v_batch.batch_no, 'expiry_date', v_batch.expiry_date,
        'quantity', v_take, 'unit_price', v_batch.sale_price);
      v_need := v_need - v_take;
    end loop;

    if v_need > 0 then
      raise exception 'Not enough in-date stock of %: % more needed. Expired batches cannot be sold.', v_med_name, v_need;
    end if;
  end loop;

  update public.sales set total = v_total where id = v_sale_id;

  return jsonb_build_object('sale_id', v_sale_id, 'total', v_total, 'lines', v_lines);
end;
$$;


-- ---------------------------------------------------------------------
-- 8. WRITE-OFF FUNCTION  (FR-13 quarantine disposal, FR-12 supplier returns)
--   'disposal' = destroy an EXPIRED (quarantined) batch.
--   'return'   = send a batch back to the supplier, only until its last return date.
-- The stock becomes 0 and the audit log records the reason and value.
-- ---------------------------------------------------------------------
create or replace function public.write_off_batch(p_batch_id bigint, p_action text, p_note text default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_batch  record;
  v_window int;
  v_today  date := public.pk_today();
begin
  if coalesce(public.get_my_role(), '') not in ('admin', 'pharmacist') then
    raise exception 'Only the Admin or Pharmacist can write off stock.';
  end if;
  if p_action not in ('disposal', 'return') then
    raise exception 'Unknown action "%".', p_action;
  end if;

  select b.id, b.quantity, b.expiry_date, s.return_window_days
    into v_batch
    from public.batches b join public.suppliers s on s.id = b.supplier_id
   where b.id = p_batch_id
     for update of b;

  if not found then
    raise exception 'Batch not found.';
  end if;
  if v_batch.quantity = 0 then
    raise exception 'This batch has no stock left.';
  end if;

  if p_action = 'disposal' and v_batch.expiry_date > v_today then
    raise exception 'Only expired (quarantined) batches can be disposed of.';
  end if;
  v_window := v_batch.return_window_days;
  if p_action = 'return' and v_today > v_batch.expiry_date - v_window then
    raise exception 'The supplier''s last return date (%) has passed.', v_batch.expiry_date - v_window;
  end if;

  perform set_config('expiryguard.movement', p_action, true);
  perform set_config('expiryguard.note',
    coalesce(nullif(trim(p_note), ''), case when p_action = 'disposal' then 'Expired stock disposed' else 'Returned to supplier' end),
    true);

  update public.batches set quantity = 0 where id = p_batch_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 9. DAILY SCAN HISTORY  (FR-07, FR-08, NFR-04)
-- One row per run of the daily expiry scan (Vercel Cron or "Run scan now").
-- If a run fails, the next successful run covers the missed days too.
-- ---------------------------------------------------------------------
create table if not exists public.scan_runs (
  id            bigint generated always as identity primary key,
  run_date      date not null default public.pk_today(),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  trigger       text not null check (trigger in ('cron', 'manual')),
  status        text not null check (status in ('success', 'failed')),
  covered_from  date,
  summary       jsonb,
  email_status  text,
  error         text
);

create index if not exists scan_runs_started_idx on public.scan_runs (started_at desc);


-- ---------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY
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

alter table public.profiles        enable row level security;
alter table public.suppliers       enable row level security;
alter table public.medicines       enable row level security;
alter table public.batches         enable row level security;
alter table public.sales           enable row level security;
alter table public.sale_items      enable row level security;
alter table public.stock_movements enable row level security;
alter table public.scan_runs       enable row level security;

-- PROFILES: you can see your own profile; Admin can see and edit everyone's (roles).
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

-- BATCHES: same rules as medicines. (Sales Staff change stock ONLY through process_sale.)
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

-- SALES + SALE ITEMS: Admin and Pharmacist see all sales; Sales Staff see their own.
-- Nobody can insert/edit/delete directly – sales are only created by process_sale().
drop policy if exists "sales: view" on public.sales;
create policy "sales: view" on public.sales
  for select to authenticated
  using (public.get_my_role() in ('admin', 'pharmacist') or sold_by = (select auth.uid()));

drop policy if exists "sale_items: view" on public.sale_items;
create policy "sale_items: view" on public.sale_items
  for select to authenticated
  using (
    public.get_my_role() in ('admin', 'pharmacist')
    or exists (select 1 from public.sales s where s.id = sale_id and s.sold_by = (select auth.uid()))
  );

-- AUDIT LOG: read-only, Admin + Pharmacist. Rows are written only by the trigger.
drop policy if exists "stock_movements: view" on public.stock_movements;
create policy "stock_movements: view" on public.stock_movements
  for select to authenticated
  using (public.get_my_role() in ('admin', 'pharmacist'));

-- SCAN RUNS: Admin + Pharmacist can view; Admin can start a manual scan.
-- (The daily Vercel Cron uses the server-only service key, which skips RLS.)
drop policy if exists "scan_runs: view" on public.scan_runs;
create policy "scan_runs: view" on public.scan_runs
  for select to authenticated
  using (public.get_my_role() in ('admin', 'pharmacist'));

drop policy if exists "scan_runs: admin adds" on public.scan_runs;
create policy "scan_runs: admin adds" on public.scan_runs
  for insert to authenticated
  with check (public.get_my_role() = 'admin');

-- Table permissions for logged-in users (RLS above still decides which rows).
grant select, insert, update, delete on public.suppliers, public.medicines, public.batches to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.sales, public.sale_items, public.stock_movements to authenticated;
grant select, insert on public.scan_runs to authenticated;

-- Only logged-in users may call the business functions (each one also checks the role).
revoke execute on function public.process_sale(jsonb) from public, anon;
revoke execute on function public.write_off_batch(bigint, text, text) from public, anon;
grant execute on function public.process_sale(jsonb) to authenticated;
grant execute on function public.write_off_batch(bigint, text, text) to authenticated;
