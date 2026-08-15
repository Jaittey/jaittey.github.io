-- Small Business (SB) v3.2.0
-- Supabase/Postgres schema, Row Level Security, Storage policies and RPCs.
-- Run this entire file once in Supabase Dashboard -> SQL Editor -> New query.

create extension if not exists pgcrypto;

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.platform_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  photo_url text not null default '',
  is_super_admin boolean not null default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED')),
  last_login_at timestamptz,
  status_updated_at timestamptz,
  status_updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists platform_users_email_lower_uq on public.platform_users (lower(email));

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text not null default '',
  registration_number text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  currency text not null default 'MVR',
  industry text not null default '',
  owner_id uuid not null references auth.users(id) on delete restrict,
  owner_email text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id)
);

create table if not exists public.business_memberships (
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  user_id uuid references auth.users(id) on delete set null,
  business_name text not null default '',
  display_name text not null default '',
  role text not null default 'user' check (role in ('administrator','manager','user')),
  active boolean not null default true,
  notes text not null default '',
  custom_permissions boolean not null default false,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,email)
);
-- A user may be invited into other businesses, but can own/register only one business.
drop index if exists public.business_memberships_one_business_email_uq;
create index if not exists business_memberships_email_lower_idx on public.business_memberships (lower(email));
create index if not exists business_memberships_user_id_idx on public.business_memberships(user_id);

create table if not exists public.business_subscriptions (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  business_name text not null default '',
  plan_id text not null default '',
  plan_name text not null default '',
  status text not null default 'NONE' check (status in ('NONE','PENDING_VERIFICATION','ACTIVE','SUSPENDED','EXPIRED','REJECTED')),
  billing_period text not null default 'MONTHLY' check (billing_period in ('MONTHLY','YEARLY')),
  amount numeric(14,2) not null default 0,
  currency text not null default 'MVR',
  starts_at timestamptz,
  ends_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  verification_notes text not null default '',
  complimentary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing ERP objects are kept as JSONB records. This preserves the current app's
-- document shape while Postgres/RLS provide tenant isolation.
create table if not exists public.business_records (
  business_id uuid not null references public.businesses(id) on delete cascade,
  collection_name text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,collection_name,id)
);
create index if not exists business_records_collection_idx on public.business_records(business_id,collection_name);

create table if not exists public.contract_generated_periods (
  business_id uuid not null references public.businesses(id) on delete cascade,
  contract_id text not null,
  period_key text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (business_id,contract_id,period_key)
);

create table if not exists public.company_assets (
  business_id uuid not null references public.businesses(id) on delete cascade,
  asset_id text not null check (asset_id in ('companyLogo','companyStamp','managerSignature')),
  storage_path text not null,
  file_name text not null default '',
  content_type text not null default 'image/png',
  uploaded_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,asset_id)
);

create table if not exists public.platform_plan_settings (
  plan_id text primary key check (plan_id in ('SILVER','GOLD','PLATINUM')),
  monthly_price numeric(14,2) not null default 0,
  yearly_price numeric(14,2) not null default 0,
  currency text not null default 'MVR',
  monthly_billing_cycle_days integer not null default 30,
  yearly_billing_cycle_days integer not null default 365,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'BANK_TRANSFER',
  instructions text not null default '',
  account_label text not null default '',
  icon text not null default '▣',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_bank_accounts (
  bank_id text primary key check (bank_id in ('BML','MIB')),
  name text not null,
  short_name text not null,
  account_number text not null,
  account_name text not null,
  active boolean not null default true,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  business_name text not null default '',
  plan_id text not null,
  plan_name text not null default '',
  billing_period text not null default 'MONTHLY' check (billing_period in ('MONTHLY','YEARLY')),
  amount numeric(14,2) not null default 0,
  currency text not null default 'MVR',
  payment_method_id uuid,
  payment_method_name text not null default '',
  payment_reference text not null default '',
  bank_id text,
  detected_bank_id text not null default '',
  bank_name text not null default '',
  destination_account_number text not null default '',
  destination_account_name text not null default '',
  detected_amount numeric(14,2) not null default 0,
  detected_reference text not null default '',
  normalized_reference text not null default '',
  detected_destination_account text not null default '',
  ocr_confidence numeric(6,2) not null default 0,
  ocr_text text not null default '',
  receipt_file_hash text not null default '',
  receipt_storage_path text not null default '',
  receipt_file_name text not null default '',
  receipt_file_type text not null default '',
  receipt_risk_level text not null default 'REVIEW',
  receipt_warnings jsonb not null default '[]'::jsonb,
  auto_reject_reasons jsonb not null default '[]'::jsonb,
  payer_name text not null default '',
  payer_contact text not null default '',
  business_registration_number text not null default '',
  identity_reference text not null default '',
  verification_notes text not null default '',
  requester_id uuid references auth.users(id) on delete set null,
  requester_email text not null,
  requester_name text not null default '',
  status text not null default 'PENDING_VERIFICATION',
  verification_status text not null default 'PENDING',
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text,
  reviewed_at timestamptz,
  reviewed_by text,
  review_message text not null default '',
  rejection_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscription_requests_business_idx on public.subscription_requests(business_id,created_at desc);

create table if not exists public.subscription_payments (
  id uuid primary key,
  request_id uuid not null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  business_name text not null default '',
  plan_id text not null,
  plan_name text not null default '',
  billing_period text not null default 'MONTHLY',
  amount numeric(14,2) not null default 0,
  currency text not null default 'MVR',
  payment_method_id uuid,
  payment_method_name text not null default '',
  payment_reference text not null default '',
  bank_id text,
  detected_bank_id text not null default '',
  bank_name text not null default '',
  destination_account_number text not null default '',
  destination_account_name text not null default '',
  detected_amount numeric(14,2) not null default 0,
  detected_reference text not null default '',
  normalized_reference text not null default '',
  detected_destination_account text not null default '',
  ocr_confidence numeric(6,2) not null default 0,
  ocr_text text not null default '',
  receipt_file_hash text not null default '',
  receipt_storage_path text not null default '',
  receipt_file_name text not null default '',
  receipt_file_type text not null default '',
  receipt_risk_level text not null default 'REVIEW',
  receipt_warnings jsonb not null default '[]'::jsonb,
  auto_reject_reasons jsonb not null default '[]'::jsonb,
  payer_name text not null default '',
  payer_contact text not null default '',
  business_registration_number text not null default '',
  identity_reference text not null default '',
  verification_notes text not null default '',
  requester_id uuid references auth.users(id) on delete set null,
  requester_email text not null,
  requester_name text not null default '',
  status text not null default 'PENDING_VERIFICATION',
  verification_status text not null default 'PENDING',
  payment_status text not null default 'PENDING_VERIFICATION',
  verified_at timestamptz,
  verified_by text,
  rejection_reason text not null default '',
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscription_payments_business_idx on public.subscription_payments(business_id,created_at desc);

create table if not exists public.subscription_receipt_references (
  bank_id text not null,
  normalized_reference text not null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(bank_id,normalized_reference)
);

create table if not exists public.subscription_receipt_hashes (
  receipt_file_hash text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  request_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.mail_queue (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  subject text not null,
  body_text text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING' check (status in ('PENDING','SENT','FAILED')),
  error_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Defaults for v3.1/v3.2 requirements.
insert into public.platform_plan_settings(plan_id) values ('SILVER'),('GOLD'),('PLATINUM')
on conflict (plan_id) do nothing;

insert into public.platform_bank_accounts(bank_id,name,short_name,account_number,account_name,active)
values
  ('BML','Bank of Maldives','BML','7709516071101','Ali Jailam',true),
  ('MIB','Maldives Islamic Bank','MIB','90103100571591000','Ali Jailam',true)
on conflict (bank_id) do nothing;

-- ============================================================
-- SECURITY HELPERS
-- ============================================================

create or replace function public.sb_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email',''));
$$;

create or replace function public.sb_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sb_email() = 'jaeitte@gmail.com';
$$;

create or replace function public.sb_platform_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sb_is_super_admin()
    or exists (
      select 1 from public.platform_users p
      where p.id = (select auth.uid()) and p.status = 'ACTIVE'
    );
$$;

create or replace function public.sb_is_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sb_platform_active()
    and exists (
      select 1 from public.business_memberships m
      where m.business_id = p_business_id
        and m.active = true
        and (
          m.user_id = (select auth.uid())
          or lower(m.email) = public.sb_email()
        )
    );
$$;

create or replace function public.sb_role(p_business_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select m.role from public.business_memberships m
    where m.business_id = p_business_id
      and m.active = true
      and (m.user_id = (select auth.uid()) or lower(m.email) = public.sb_email())
    limit 1
  ),'');
$$;

create or replace function public.sb_is_business_admin(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sb_is_member(p_business_id) and public.sb_role(p_business_id) = 'administrator';
$$;

create or replace function public.sb_is_business_manager(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sb_is_member(p_business_id) and public.sb_role(p_business_id) in ('administrator','manager');
$$;

create or replace function public.sb_role_can(p_business_id uuid, p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m public.business_memberships%rowtype;
begin
  select * into m from public.business_memberships
  where business_id = p_business_id
    and active = true
    and (user_id = (select auth.uid()) or lower(email) = public.sb_email())
  limit 1;

  if not found or not public.sb_platform_active() then return false; end if;
  if m.role = 'administrator' then return true; end if;
  if m.custom_permissions then return p_permission = any(m.permissions); end if;
  if m.role = 'manager' then return true; end if;

  return p_permission = any(array[
    'quotes','invoices','customers','products','employees','attendance','payroll','preferences'
  ]::text[]);
end;
$$;

create or replace function public.sb_subscription_active(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_subscriptions s
    where s.business_id = p_business_id
      and s.status = 'ACTIVE'
      and (s.ends_at is null or s.ends_at > now())
  );
$$;

create or replace function public.sb_plan_id(p_business_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select s.plan_id from public.business_subscriptions s
    where s.business_id=p_business_id and s.status='ACTIVE' and (s.ends_at is null or s.ends_at > now()) limit 1),'');
$$;

create or replace function public.sb_plan_allows(p_business_id uuid, p_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare p text := public.sb_plan_id(p_business_id);
begin
  if p = 'SILVER' then
    return p_permission = any(array['dashboard','quotes','invoices','customers','products']::text[]);
  elsif p = 'GOLD' then
    return p_permission = any(array[
      'dashboard','quotes','invoices','billing','payments','customers','contracts','statements',
      'employees','hr-records','payroll','attendance','attendance-settings','products','suppliers','assets'
    ]::text[]);
  elsif p = 'PLATINUM' then
    return p_permission = any(array[
      'dashboard','quotes','invoices','billing','payments','customers','contracts','statements',
      'employees','hr-records','payroll','attendance','attendance-settings','finance','expenses','budget','tax',
      'products','suppliers','assets','reports','cloud','notifications'
    ]::text[]);
  end if;
  return false;
end;
$$;

create or replace function public.sb_can_use(p_business_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sb_role_can(p_business_id,p_permission)
    and public.sb_plan_allows(p_business_id,p_permission);
$$;

create or replace function public.sb_collection_feature(p_collection text)
returns text
language sql
immutable
as $$
  select case p_collection
    when 'customers' then 'customers'
    when 'products' then 'products'
    when 'invoices' then 'invoices'
    when 'quotes' then 'quotes'
    when 'billingContracts' then 'billing'
    when 'payments' then 'payments'
    when 'employees' then 'employees'
    when 'attendance' then 'attendance'
    when 'attendanceDocuments' then 'attendance'
    when 'payroll' then 'payroll'
    when 'salarySlips' then 'payroll'
    when 'payrollPeriods' then 'payroll'
    when 'finalSettlements' then 'payroll'
    when 'expenses' then 'expenses'
    when 'budgets' then 'budget'
    else null
  end;
$$;

create or replace function public.sb_payroll_period_open(p_business_id uuid, p_month text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select (r.data->>'status') = 'OPEN'
    from public.business_records r
    where r.business_id=p_business_id and r.collection_name='payrollPeriods' and r.id=p_month
  ), true);
$$;

create or replace function public.sb_can_write_record(p_business_id uuid, p_collection text, p_id text, p_data jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare feature text := public.sb_collection_feature(p_collection);
begin
  if not public.sb_is_member(p_business_id) then return false; end if;
  if p_collection = 'activityLogs' then return true; end if;
  if p_collection = 'settings' then
    return public.sb_is_business_admin(p_business_id)
      or (p_id='attendance' and public.sb_is_business_manager(p_business_id) and public.sb_plan_allows(p_business_id,'attendance-settings'));
  end if;
  if p_collection = 'employees' then
    return public.sb_is_business_manager(p_business_id) and public.sb_plan_allows(p_business_id,'employees');
  end if;
  if p_collection in ('payroll','salarySlips','payrollPeriods','finalSettlements') then
    return public.sb_is_business_manager(p_business_id) and public.sb_plan_allows(p_business_id,'payroll');
  end if;
  if p_collection = 'attendance' then
    return public.sb_can_use(p_business_id,'attendance')
      and public.sb_payroll_period_open(p_business_id,coalesce(p_data->>'attendanceMonth',left(p_data->>'date',7)));
  end if;
  if feature is not null then return public.sb_can_use(p_business_id,feature); end if;
  return false;
end;
$$;

-- ============================================================
-- AUTH PROFILE / BUSINESS RPCS
-- ============================================================

create or replace function public.sb_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.platform_users(id,email,display_name,photo_url,is_super_admin,status,last_login_at,updated_at)
  values (
    new.id,
    lower(coalesce(new.email,'')),
    coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),
    coalesce(new.raw_user_meta_data->>'avatar_url',new.raw_user_meta_data->>'picture',''),
    lower(coalesce(new.email,''))='jaeitte@gmail.com',
    'ACTIVE',
    now(),
    now()
  )
  on conflict (id) do update set
    email=excluded.email,
    display_name=excluded.display_name,
    photo_url=excluded.photo_url,
    is_super_admin=excluded.is_super_admin,
    updated_at=now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_sb on auth.users;
create trigger on_auth_user_created_sb
after insert on auth.users
for each row execute function public.sb_handle_new_user();


create or replace function public.sb_protect_platform_user_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sb_is_super_admin() then
    new.status := old.status;
    new.is_super_admin := old.is_super_admin;
    new.status_updated_at := old.status_updated_at;
    new.status_updated_by := old.status_updated_by;
    new.email := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_platform_user_security_sb on public.platform_users;
create trigger protect_platform_user_security_sb
before update on public.platform_users
for each row execute function public.sb_protect_platform_user_security();

create or replace function public.sb_claim_membership()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then return; end if;
  update public.business_memberships
    set user_id=(select auth.uid()), updated_at=now()
  where lower(email)=public.sb_email()
    and (user_id is null or user_id=(select auth.uid()));
end;
$$;

create or replace function public.sb_register_business(p_form jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  em text := public.sb_email();
  bid uuid := gen_random_uuid();
  bname text := trim(coalesce(p_form->>'name',p_form->>'businessName',''));
begin
  if uid is null or em='' then raise exception 'Sign in before registering a business.'; end if;
  if not public.sb_platform_active() then raise exception 'This platform account is not active.'; end if;
  if bname='' then raise exception 'Business name is required.'; end if;
  if exists(select 1 from public.businesses where owner_id=uid) then
    raise exception 'Each Small Business account can register only one owned business.';
  end if;

  insert into public.businesses(
    id,name,legal_name,registration_number,address,phone,email,currency,industry,owner_id,owner_email,status
  ) values (
    bid,bname,coalesce(p_form->>'legalName',bname),coalesce(p_form->>'registrationNumber',''),
    coalesce(p_form->>'address',''),coalesce(p_form->>'phone',''),coalesce(p_form->>'email',em),
    upper(coalesce(nullif(p_form->>'currency',''),'MVR')),coalesce(p_form->>'industry',''),uid,em,'ACTIVE'
  );

  insert into public.business_memberships(
    business_id,email,user_id,business_name,display_name,role,active,custom_permissions,permissions
  ) values (
    bid,em,uid,bname,coalesce((select display_name from public.platform_users where id=uid),''),
    'administrator',true,false,array['*']::text[]
  );

  insert into public.business_records(business_id,collection_name,id,data)
  values (
    bid,'settings','business',
    jsonb_build_object(
      'businessName',bname,
      'shortName',coalesce(nullif(p_form->>'shortName',''),left(bname,12)),
      'address',coalesce(p_form->>'address',''),
      'phone',coalesce(p_form->>'phone',''),
      'email',coalesce(p_form->>'email',em),
      'currency',upper(coalesce(nullif(p_form->>'currency',''),'MVR')),
      'registrationNumber',coalesce(p_form->>'registrationNumber',''),
      'driveRootFolder','Small Business - '||bname||' - '||left(bid::text,6),
      'createdAt',now(),'updatedAt',now()
    )
  );

  if em='jaeitte@gmail.com' then
    insert into public.business_subscriptions(
      business_id,business_name,plan_id,plan_name,status,billing_period,amount,currency,starts_at,ends_at,approved_at,approved_by,complimentary
    ) values (
      bid,bname,'PLATINUM','VIP Platinum','ACTIVE','YEARLY',0,'MVR',now(),null,now(),em,true
    ) on conflict (business_id) do update set plan_id='PLATINUM',plan_name='VIP Platinum',status='ACTIVE',complimentary=true,updated_at=now();
  end if;

  return bid;
end;
$$;

-- ============================================================
-- ATOMIC ERP RPCS
-- ============================================================

create or replace function public.sb_save_invoice_with_stock(p_business_id uuid,p_invoice_id text,p_invoice jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  iid text := coalesce(nullif(p_invoice_id,''),gen_random_uuid()::text);
  old_invoice jsonb;
  product jsonb;
  diff_row record;
  next_qty numeric;
begin
  if not public.sb_can_use(p_business_id,'invoices') then raise exception 'Invoice access denied.'; end if;

  select data into old_invoice from public.business_records
  where business_id=p_business_id and collection_name='invoices' and id=iid for update;

  for diff_row in
    with old_items as (
      select item->>'productId' product_id, sum(coalesce(nullif(item->>'quantity','')::numeric,0)) qty
      from jsonb_array_elements(coalesce(old_invoice->'items','[]'::jsonb)) item
      where coalesce(item->>'productId','')<>'' group by item->>'productId'
    ), new_items as (
      select item->>'productId' product_id, sum(coalesce(nullif(item->>'quantity','')::numeric,0)) qty
      from jsonb_array_elements(coalesce(p_invoice->'items','[]'::jsonb)) item
      where coalesce(item->>'productId','')<>'' group by item->>'productId'
    )
    select coalesce(n.product_id,o.product_id) product_id,coalesce(n.qty,0)-coalesce(o.qty,0) difference
    from new_items n full join old_items o using(product_id)
  loop
    select data into product from public.business_records
    where business_id=p_business_id and collection_name='products' and id=diff_row.product_id for update;
    if product is null then raise exception 'A selected stock item no longer exists.'; end if;
    next_qty := coalesce(nullif(product->>'quantity','')::numeric,0)-diff_row.difference;
    if next_qty < 0 then raise exception 'Not enough stock for %.',coalesce(product->>'name','selected item'); end if;
    update public.business_records
      set data=jsonb_set(product,'{quantity}',to_jsonb(next_qty),true)||jsonb_build_object('updatedAt',now()),updated_at=now()
    where business_id=p_business_id and collection_name='products' and id=diff_row.product_id;
  end loop;

  insert into public.business_records(business_id,collection_name,id,data,created_at,updated_at)
  values (p_business_id,'invoices',iid,
    p_invoice||jsonb_build_object('createdAt',coalesce(old_invoice->'createdAt',to_jsonb(now())),'updatedAt',now()),now(),now())
  on conflict (business_id,collection_name,id) do update
    set data=excluded.data,updated_at=now();
  return iid;
end;
$$;

create or replace function public.sb_delete_invoice_restore_stock(p_business_id uuid,p_invoice_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare inv jsonb; item jsonb; product jsonb; qty numeric; next_qty numeric;
begin
  if not public.sb_can_use(p_business_id,'invoices') then raise exception 'Invoice access denied.'; end if;
  select data into inv from public.business_records where business_id=p_business_id and collection_name='invoices' and id=p_invoice_id for update;
  if inv is null then return; end if;
  for item in select * from jsonb_array_elements(coalesce(inv->'items','[]'::jsonb)) loop
    if coalesce(item->>'productId','')<>'' then
      qty:=coalesce(nullif(item->>'quantity','')::numeric,0);
      select data into product from public.business_records where business_id=p_business_id and collection_name='products' and id=item->>'productId' for update;
      if product is not null then
        next_qty:=coalesce(nullif(product->>'quantity','')::numeric,0)+qty;
        update public.business_records set data=jsonb_set(product,'{quantity}',to_jsonb(next_qty),true)||jsonb_build_object('updatedAt',now()),updated_at=now()
        where business_id=p_business_id and collection_name='products' and id=item->>'productId';
      end if;
    end if;
  end loop;
  delete from public.business_records where business_id=p_business_id and collection_name='invoices' and id=p_invoice_id;
end;
$$;

create or replace function public.sb_generate_contract_invoice(p_business_id uuid,p_contract_id text,p_period_key text,p_invoice jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare iid text:=gen_random_uuid()::text; contract_data jsonb;
begin
  if not public.sb_can_use(p_business_id,'billing') then raise exception 'Recurring billing access denied.'; end if;
  if exists(select 1 from public.contract_generated_periods where business_id=p_business_id and contract_id=p_contract_id and period_key=p_period_key) then
    raise exception 'An invoice has already been generated for this service period.';
  end if;
  select data into contract_data from public.business_records where business_id=p_business_id and collection_name='billingContracts' and id=p_contract_id for update;
  if contract_data is null then raise exception 'Billing contract no longer exists.'; end if;
  insert into public.business_records(business_id,collection_name,id,data)
  values(p_business_id,'invoices',iid,p_invoice||jsonb_build_object('sourceContractId',p_contract_id,'createdAt',now(),'updatedAt',now()));
  insert into public.contract_generated_periods(business_id,contract_id,period_key,data)
  values(p_business_id,p_contract_id,p_period_key,jsonb_build_object('invoiceId',iid,'invoiceNumber',p_invoice->>'invoiceNumber','servicePeriod',p_invoice->>'servicePeriod','generatedAt',now()));
  update public.business_records set data=contract_data||jsonb_build_object('lastGeneratedPeriod',p_period_key,'lastInvoiceId',iid,'updatedAt',now()),updated_at=now()
  where business_id=p_business_id and collection_name='billingContracts' and id=p_contract_id;
  return iid;
end;
$$;

create or replace function public.sb_receive_invoice_payment(p_business_id uuid,p_invoice_id text,p_payment jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare inv jsonb; pid text:=gen_random_uuid()::text; previous_paid numeric; amount numeric; total numeric; paid numeric; balance numeric;
begin
  if not public.sb_can_use(p_business_id,'payments') then raise exception 'Payment access denied.'; end if;
  select data into inv from public.business_records where business_id=p_business_id and collection_name='invoices' and id=p_invoice_id for update;
  if inv is null then raise exception 'The selected invoice no longer exists.'; end if;
  previous_paid:=coalesce(nullif(inv->>'amountPaid','')::numeric,0);
  amount:=coalesce(nullif(p_payment->>'amount','')::numeric,0);
  total:=coalesce(nullif(inv->>'total','')::numeric,0);
  paid:=previous_paid+amount; balance:=greatest(0,total-paid);
  insert into public.business_records(business_id,collection_name,id,data)
  values(p_business_id,'payments',pid,p_payment||jsonb_build_object('invoiceId',p_invoice_id,'invoiceNumber',inv->>'invoiceNumber','customerId',coalesce(inv->>'customerId',''),'customerName',coalesce(inv->>'customerName',''),'createdAt',now(),'updatedAt',now()));
  update public.business_records set data=inv||jsonb_build_object('amountPaid',paid,'balanceDue',balance,'status',case when balance<=0 then 'PAID' else coalesce(inv->>'status','') end,'updatedAt',now()),updated_at=now()
  where business_id=p_business_id and collection_name='invoices' and id=p_invoice_id;
  return pid;
end;
$$;

create or replace function public.sb_process_final_settlement(p_business_id uuid,p_employee_id text,p_employee jsonb,p_settlement jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare last_date text:=p_settlement->>'lastWorkingDate'; settlement_id text; salary_month text; regular_id text; existing jsonb; regular jsonb; common jsonb;
begin
  if not public.sb_is_business_manager(p_business_id) or not public.sb_plan_allows(p_business_id,'payroll') then raise exception 'Payroll access denied.'; end if;
  if p_employee_id='' or coalesce(last_date,'')='' then raise exception 'Employee and last working date are required.'; end if;
  settlement_id:=regexp_replace(p_employee_id||'_'||last_date,'[^a-zA-Z0-9_-]','','g');
  salary_month:=coalesce(nullif(p_settlement->>'salaryMonth',''),left(last_date,7));
  regular_id:=regexp_replace(p_employee_id||'_'||salary_month,'[^a-zA-Z0-9_-]','','g');
  select data into existing from public.business_records where business_id=p_business_id and collection_name='finalSettlements' and id=settlement_id;
  if existing is not null then raise exception 'A final settlement already exists for this employee and last working date.'; end if;
  select data into regular from public.business_records where business_id=p_business_id and collection_name='payroll' and id=regular_id for update;
  if regular is not null and regular->>'status'='PAID' then raise exception 'A paid monthly payroll record already exists for the final month.'; end if;
  common:=p_settlement||jsonb_build_object('employeeId',p_employee_id,'employeeNumber',coalesce(p_employee->>'employeeNumber',''),'employeeName',coalesce(p_employee->>'name',''),'designation',coalesce(p_employee->>'designation',''),'department',coalesce(p_employee->>'department',''),'workLocation',coalesce(p_employee->>'workLocation',''),'payrollType',coalesce(p_employee->>'payrollType','MONTHLY'),'recordType','FINAL_SETTLEMENT','createdAt',now(),'updatedAt',now());
  insert into public.business_records(business_id,collection_name,id,data) values(p_business_id,'finalSettlements',settlement_id,common);
  insert into public.business_records(business_id,collection_name,id,data) values(p_business_id,'payroll','FINAL_'||settlement_id,common);
  if regular is not null then
    update public.business_records set data=regular||jsonb_build_object('status','CANCELLED','cancelledReason','Replaced by final salary settlement','finalSettlementId',settlement_id,'updatedAt',now()),updated_at=now()
    where business_id=p_business_id and collection_name='payroll' and id=regular_id;
  end if;
  update public.business_records set data=data||jsonb_build_object('status','INACTIVE','lastWorkingDate',last_date,'leavingReason',coalesce(p_settlement->>'reasonForLeaving',''),'finalSettlementId',settlement_id,'updatedAt',now()),updated_at=now()
  where business_id=p_business_id and collection_name='employees' and id=p_employee_id;
  return settlement_id;
end;
$$;

-- ============================================================
-- SUBSCRIPTION RECEIPT RPCS
-- ============================================================

create or replace function public.sb_find_duplicate_receipt(p_business_id uuid,p_bank_id text,p_reference text,p_file_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare result jsonb:='[]'::jsonb;
begin
  if not public.sb_is_business_admin(p_business_id) then
    raise exception 'Company Administrator access required.';
  end if;

  if coalesce(p_bank_id,'')<>'' and coalesce(p_reference,'')<>'' and exists(
    select 1 from public.subscription_receipt_references
    where bank_id=upper(p_bank_id) and normalized_reference=upper(p_reference)
  ) then
    result:=result||jsonb_build_array(jsonb_build_object('type','REFERENCE'));
  end if;

  if coalesce(p_file_hash,'')<>'' and exists(
    select 1 from public.subscription_receipt_hashes where receipt_file_hash=p_file_hash
  ) then
    result:=result||jsonb_build_array(jsonb_build_object('type','FILE_HASH'));
  end if;

  return result;
end;
$$;

create or replace function public.sb_submit_subscription_receipt(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bid uuid := (p_payload->>'business_id')::uuid;
  rid uuid := gen_random_uuid();
  selected_bank text := upper(coalesce(p_payload->>'bank_id',''));
  detected_bank text := upper(coalesce(p_payload->>'detected_bank_id',''));
  ref text := upper(regexp_replace(coalesce(p_payload->>'normalized_reference',''),'[^A-Z0-9]','','g'));
  hash text := coalesce(p_payload->>'receipt_file_hash','');
  storage_path text := coalesce(p_payload->>'receipt_storage_path','');
  billing text := upper(coalesce(p_payload->>'billing_period','MONTHLY'));
  selected_plan text := upper(coalesce(p_payload->>'plan_id',''));
  reasons jsonb := coalesce(p_payload->'auto_reject_reasons','[]'::jsonb);
  warnings jsonb := coalesce(p_payload->'receipt_warnings','[]'::jsonb);
  duplicate_ref boolean := false;
  duplicate_hash boolean := false;
  stat text;
  expected_amount numeric := 0;
  detected_amount numeric := coalesce(nullif(p_payload->>'detected_amount','')::numeric,0);
  bank_row public.platform_bank_accounts%rowtype;
  plan_row public.platform_plan_settings%rowtype;
begin
  if not public.sb_is_business_admin(bid) then raise exception 'Only the Company Administrator can submit a subscription.'; end if;
  if lower(coalesce(p_payload->>'requester_email',''))<>public.sb_email() then raise exception 'Requester identity does not match the signed-in account.'; end if;
  if billing not in ('MONTHLY','YEARLY') then raise exception 'Billing period must be MONTHLY or YEARLY.'; end if;
  if selected_plan not in ('SILVER','GOLD','PLATINUM') then raise exception 'Unsupported subscription package.'; end if;
  if selected_bank not in ('BML','MIB') then raise exception 'Unsupported subscription bank.'; end if;

  if exists(
    select 1 from public.subscription_requests
    where business_id=bid and status in ('PENDING_VERIFICATION','MORE_INFO_REQUIRED')
  ) then
    raise exception 'This business already has a subscription request waiting for verification.';
  end if;

  select * into plan_row from public.platform_plan_settings where plan_id=selected_plan and active=true;
  if not found then raise exception 'The selected subscription package is not active.'; end if;
  expected_amount := case when billing='YEARLY' then plan_row.yearly_price else plan_row.monthly_price end;
  if expected_amount<=0 then raise exception 'The selected subscription price has not been configured.'; end if;

  select * into bank_row from public.platform_bank_accounts where bank_id=selected_bank and active=true;
  if not found then raise exception 'The selected bank-transfer account is not active.'; end if;

  if storage_path='' or position(bid::text||'/' in storage_path)<>1 then
    reasons:=reasons||jsonb_build_array('Uploaded receipt path is invalid for this business.');
  elsif not exists(
    select 1 from storage.objects where bucket_id='subscription-receipts' and name=storage_path
  ) then
    reasons:=reasons||jsonb_build_array('Uploaded receipt file could not be verified in storage.');
  end if;

  if detected_bank<>'' and detected_bank<>selected_bank then
    reasons:=reasons||jsonb_build_array('Detected bank does not match the selected bank.');
  end if;
  if detected_amount<=0 then
    reasons:=reasons||jsonb_build_array('Transferred amount could not be detected.');
  elsif abs(detected_amount-expected_amount)>0.01 then
    reasons:=reasons||jsonb_build_array('Transferred amount does not match the configured subscription price.');
  end if;
  if ref='' then reasons:=reasons||jsonb_build_array('Transaction reference could not be detected.'); end if;
  if hash='' then reasons:=reasons||jsonb_build_array('Receipt file fingerprint is missing.'); end if;

  if selected_bank='BML' and regexp_replace(coalesce(p_payload->>'detected_destination_account',''),'[^0-9]','','g') <> regexp_replace(bank_row.account_number,'[^0-9]','','g') then
    reasons:=reasons||jsonb_build_array('BML destination account does not match the configured subscription account.');
  elsif selected_bank='MIB' and coalesce(p_payload->>'detected_destination_account','')='' then
    warnings:=warnings||jsonb_build_array('MIB receipt format may not show the destination account number; manual Super Admin verification is required.');
  end if;

  duplicate_ref := ref<>'' and exists(
    select 1 from public.subscription_receipt_references
    where bank_id=selected_bank and normalized_reference=ref
  );
  duplicate_hash := hash<>'' and exists(
    select 1 from public.subscription_receipt_hashes where receipt_file_hash=hash
  );
  if duplicate_ref then reasons:=reasons||jsonb_build_array('Duplicate transaction reference detected.'); end if;
  if duplicate_hash then reasons:=reasons||jsonb_build_array('This exact receipt image has already been submitted.'); end if;

  stat:=case when jsonb_array_length(reasons)>0 then 'AUTO_REJECTED' else 'PENDING_VERIFICATION' end;

  insert into public.subscription_requests(
    id,request_id,business_id,business_name,plan_id,plan_name,billing_period,amount,currency,
    bank_id,detected_bank_id,bank_name,destination_account_number,destination_account_name,detected_amount,detected_reference,normalized_reference,
    detected_destination_account,ocr_confidence,ocr_text,receipt_file_hash,receipt_storage_path,receipt_file_name,receipt_file_type,
    receipt_risk_level,receipt_warnings,auto_reject_reasons,payer_name,payer_contact,business_registration_number,identity_reference,
    verification_notes,requester_id,requester_email,requester_name,status,verification_status,submitted_at,created_at,updated_at
  ) values (
    rid,rid,bid,coalesce(p_payload->>'business_name',''),selected_plan,coalesce(p_payload->>'plan_name',''),billing,
    expected_amount,plan_row.currency,selected_bank,detected_bank,bank_row.name,bank_row.account_number,bank_row.account_name,detected_amount,
    coalesce(p_payload->>'detected_reference',''),ref,coalesce(p_payload->>'detected_destination_account',''),
    coalesce(nullif(p_payload->>'ocr_confidence','')::numeric,0),coalesce(p_payload->>'ocr_text',''),hash,storage_path,
    coalesce(p_payload->>'receipt_file_name',''),coalesce(p_payload->>'receipt_file_type',''),coalesce(p_payload->>'receipt_risk_level','REVIEW'),
    warnings,reasons,coalesce(p_payload->>'payer_name',''),coalesce(p_payload->>'payer_contact',''),coalesce(p_payload->>'business_registration_number',''),
    coalesce(p_payload->>'identity_reference',''),coalesce(p_payload->>'verification_notes',''),(select auth.uid()),public.sb_email(),
    coalesce(p_payload->>'requester_name',''),stat,case when stat='AUTO_REJECTED' then 'AUTO_REJECTED' else 'PENDING' end,now(),now(),now()
  );

  insert into public.subscription_payments(
    id,request_id,business_id,business_name,plan_id,plan_name,billing_period,amount,currency,bank_id,detected_bank_id,bank_name,destination_account_number,destination_account_name,
    detected_amount,detected_reference,normalized_reference,detected_destination_account,ocr_confidence,ocr_text,receipt_file_hash,receipt_storage_path,
    receipt_file_name,receipt_file_type,receipt_risk_level,receipt_warnings,auto_reject_reasons,payer_name,payer_contact,business_registration_number,
    identity_reference,verification_notes,requester_id,requester_email,requester_name,status,verification_status,payment_status,submitted_at,created_at,updated_at
  )
  select id,request_id,business_id,business_name,plan_id,plan_name,billing_period,amount,currency,bank_id,detected_bank_id,bank_name,destination_account_number,destination_account_name,
    detected_amount,detected_reference,normalized_reference,detected_destination_account,ocr_confidence,ocr_text,receipt_file_hash,receipt_storage_path,
    receipt_file_name,receipt_file_type,receipt_risk_level,receipt_warnings,auto_reject_reasons,payer_name,payer_contact,business_registration_number,
    identity_reference,verification_notes,requester_id,requester_email,requester_name,status,verification_status,stat,submitted_at,created_at,updated_at
  from public.subscription_requests where id=rid;

  if not duplicate_ref and ref<>'' then
    insert into public.subscription_receipt_references(bank_id,normalized_reference,business_id,request_id)
    values(selected_bank,ref,bid,rid);
  end if;
  if not duplicate_hash and hash<>'' then
    insert into public.subscription_receipt_hashes(receipt_file_hash,business_id,request_id)
    values(hash,bid,rid);
  end if;

  insert into public.mail_queue(recipient,subject,body_text,metadata)
  values(
    'jaeitte@gmail.com',
    case when stat='AUTO_REJECTED' then 'Auto-rejected SB subscription payment' else 'New SB subscription payment' end,
    'Business: '||coalesce(p_payload->>'business_name','')||E'\nPackage: '||selected_plan||' ('||billing||')'||E'\nExpected amount: '||plan_row.currency||' '||expected_amount::text||E'\nDetected amount: '||detected_amount::text||E'\nBank: '||selected_bank||E'\nReference: '||coalesce(p_payload->>'detected_reference','')||E'\nStatus: '||stat,
    jsonb_build_object('type','SUBSCRIPTION_REQUEST','businessId',bid::text,'subscriptionRequestId',rid::text)
  );

  return jsonb_build_object('id',rid,'status',stat,'reasons',reasons,'warnings',warnings);
end;
$$;

create or replace function public.sb_review_subscription_request(p_request_id uuid,p_action text,p_notes text default '',p_starts_at date default null,p_ends_at date default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.subscription_requests%rowtype; start_ts timestamptz; end_ts timestamptz;
begin
  if not public.sb_is_super_admin() then raise exception 'Super Admin access required.'; end if;
  select * into r from public.subscription_requests where id=p_request_id for update;
  if not found then raise exception 'Subscription request not found.'; end if;

  if upper(p_action)='APPROVE' then
    if r.status='AUTO_REJECTED' then
      raise exception 'Automatically rejected receipts cannot be activated. Ask the subscriber to submit a new valid bank slip.';
    end if;
    start_ts:=coalesce(p_starts_at::timestamptz,now());
    end_ts:=coalesce(p_ends_at::timestamptz,start_ts + case when r.billing_period='YEARLY' then interval '1 year' else interval '1 month' end);
    insert into public.business_subscriptions(
      business_id,business_name,plan_id,plan_name,status,billing_period,amount,currency,starts_at,ends_at,approved_at,approved_by,verification_notes,updated_at
    ) values (
      r.business_id,r.business_name,r.plan_id,r.plan_name,'ACTIVE',r.billing_period,r.amount,r.currency,start_ts,end_ts,now(),public.sb_email(),coalesce(p_notes,''),now()
    ) on conflict (business_id) do update set
      business_name=excluded.business_name,plan_id=excluded.plan_id,plan_name=excluded.plan_name,status='ACTIVE',billing_period=excluded.billing_period,
      amount=excluded.amount,currency=excluded.currency,starts_at=excluded.starts_at,ends_at=excluded.ends_at,approved_at=now(),approved_by=public.sb_email(),
      verification_notes=excluded.verification_notes,updated_at=now();
    update public.subscription_requests set status='APPROVED',verification_status='VERIFIED',approved_at=now(),approved_by=public.sb_email(),verification_notes=coalesce(p_notes,''),updated_at=now() where id=p_request_id;
    update public.subscription_payments set status='APPROVED',verification_status='VERIFIED',payment_status='VERIFIED',verified_at=now(),verified_by=public.sb_email(),updated_at=now() where id=p_request_id;
  elsif upper(p_action)='REJECT' then
    update public.subscription_requests set status='REJECTED',verification_status='REJECTED',rejection_reason=coalesce(p_notes,''),reviewed_at=now(),reviewed_by=public.sb_email(),updated_at=now() where id=p_request_id;
    update public.subscription_payments set status='REJECTED',verification_status='REJECTED',payment_status='REJECTED',rejection_reason=coalesce(p_notes,''),updated_at=now() where id=p_request_id;
  elsif upper(p_action)='MORE_INFO' then
    update public.subscription_requests set status='MORE_INFO_REQUIRED',verification_status='MORE_INFO_REQUIRED',review_message=coalesce(p_notes,''),reviewed_at=now(),reviewed_by=public.sb_email(),updated_at=now() where id=p_request_id;
  else
    raise exception 'Unsupported verification action.';
  end if;
end;
$$;

create or replace function public.sb_set_subscription_status(p_business_id uuid,p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare s public.business_subscriptions%rowtype;
begin
  if not public.sb_is_super_admin() then raise exception 'Super Admin access required.'; end if;
  select * into s from public.business_subscriptions where business_id=p_business_id for update;
  if not found then raise exception 'Subscription not found.'; end if;
  if p_status='ACTIVE' and (s.ends_at is null or s.ends_at<=now()) then
    update public.business_subscriptions set status='ACTIVE',starts_at=now(),ends_at=now()+case when s.billing_period='YEARLY' then interval '1 year' else interval '1 month' end,updated_at=now() where business_id=p_business_id;
  else
    update public.business_subscriptions set status=p_status,updated_at=now() where business_id=p_business_id;
  end if;
end;
$$;

-- Restrict SECURITY DEFINER RPC execution to signed-in clients only.
revoke all on function public.sb_claim_membership() from public;
revoke all on function public.sb_register_business(jsonb) from public;
revoke all on function public.sb_save_invoice_with_stock(uuid,text,jsonb) from public;
revoke all on function public.sb_delete_invoice_restore_stock(uuid,text) from public;
revoke all on function public.sb_generate_contract_invoice(uuid,text,text,jsonb) from public;
revoke all on function public.sb_receive_invoice_payment(uuid,text,jsonb) from public;
revoke all on function public.sb_process_final_settlement(uuid,text,jsonb,jsonb) from public;
revoke all on function public.sb_find_duplicate_receipt(uuid,text,text,text) from public;
revoke all on function public.sb_submit_subscription_receipt(jsonb) from public;
revoke all on function public.sb_review_subscription_request(uuid,text,text,date,date) from public;
revoke all on function public.sb_set_subscription_status(uuid,text) from public;

grant execute on function public.sb_claim_membership() to authenticated;
grant execute on function public.sb_register_business(jsonb) to authenticated;
grant execute on function public.sb_save_invoice_with_stock(uuid,text,jsonb) to authenticated;
grant execute on function public.sb_delete_invoice_restore_stock(uuid,text) to authenticated;
grant execute on function public.sb_generate_contract_invoice(uuid,text,text,jsonb) to authenticated;
grant execute on function public.sb_receive_invoice_payment(uuid,text,jsonb) to authenticated;
grant execute on function public.sb_process_final_settlement(uuid,text,jsonb,jsonb) to authenticated;
grant execute on function public.sb_find_duplicate_receipt(uuid,text,text,text) to authenticated;
grant execute on function public.sb_submit_subscription_receipt(jsonb) to authenticated;
grant execute on function public.sb_review_subscription_request(uuid,text,text,date,date) to authenticated;
grant execute on function public.sb_set_subscription_status(uuid,text) to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.platform_users enable row level security;
alter table public.businesses enable row level security;
alter table public.business_memberships enable row level security;
alter table public.business_subscriptions enable row level security;
alter table public.business_records enable row level security;
alter table public.contract_generated_periods enable row level security;
alter table public.company_assets enable row level security;
alter table public.platform_plan_settings enable row level security;
alter table public.platform_payment_methods enable row level security;
alter table public.platform_bank_accounts enable row level security;
alter table public.subscription_requests enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.subscription_receipt_references enable row level security;
alter table public.subscription_receipt_hashes enable row level security;
alter table public.mail_queue enable row level security;

-- Re-running schema is safe: drop named policies first.
drop policy if exists platform_users_select on public.platform_users;
drop policy if exists platform_users_insert on public.platform_users;
drop policy if exists platform_users_update on public.platform_users;
create policy platform_users_select on public.platform_users for select to authenticated using (id=(select auth.uid()) or public.sb_is_super_admin());
create policy platform_users_insert on public.platform_users for insert to authenticated with check (id=(select auth.uid()) and lower(email)=public.sb_email() and is_super_admin=public.sb_is_super_admin() and status='ACTIVE');
create policy platform_users_update on public.platform_users for update to authenticated using (id=(select auth.uid()) or public.sb_is_super_admin()) with check (public.sb_is_super_admin() or (id=(select auth.uid()) and lower(email)=public.sb_email()));

drop policy if exists businesses_select on public.businesses;
drop policy if exists businesses_update on public.businesses;
create policy businesses_select on public.businesses for select to authenticated using (public.sb_is_super_admin() or public.sb_is_member(id));
create policy businesses_update on public.businesses for update to authenticated using (public.sb_is_super_admin() or public.sb_is_business_admin(id)) with check (public.sb_is_super_admin() or public.sb_is_business_admin(id));

drop policy if exists memberships_select on public.business_memberships;
drop policy if exists memberships_insert on public.business_memberships;
drop policy if exists memberships_update on public.business_memberships;
drop policy if exists memberships_delete on public.business_memberships;
create policy memberships_select on public.business_memberships for select to authenticated using (public.sb_is_super_admin() or public.sb_is_business_admin(business_id) or lower(email)=public.sb_email() or user_id=(select auth.uid()));
create policy memberships_insert on public.business_memberships for insert to authenticated with check (public.sb_is_super_admin() or public.sb_is_business_admin(business_id));
create policy memberships_update on public.business_memberships for update to authenticated using (public.sb_is_super_admin() or public.sb_is_business_admin(business_id)) with check (public.sb_is_super_admin() or public.sb_is_business_admin(business_id));
create policy memberships_delete on public.business_memberships for delete to authenticated using (public.sb_is_super_admin() or public.sb_is_business_admin(business_id));

drop policy if exists subscriptions_select on public.business_subscriptions;
drop policy if exists subscriptions_write on public.business_subscriptions;
create policy subscriptions_select on public.business_subscriptions for select to authenticated using (public.sb_is_super_admin() or public.sb_is_member(business_id));
create policy subscriptions_write on public.business_subscriptions for all to authenticated using (public.sb_is_super_admin()) with check (public.sb_is_super_admin());

drop policy if exists business_records_select on public.business_records;
drop policy if exists business_records_insert on public.business_records;
drop policy if exists business_records_update on public.business_records;
drop policy if exists business_records_delete on public.business_records;
create policy business_records_select on public.business_records for select to authenticated using (
  (collection_name='settings' and public.sb_is_member(business_id))
  or (collection_name='activityLogs' and public.sb_is_business_admin(business_id))
  or (public.sb_collection_feature(collection_name) is not null and public.sb_can_use(business_id,public.sb_collection_feature(collection_name)))
);
create policy business_records_insert on public.business_records for insert to authenticated with check (public.sb_can_write_record(business_id,collection_name,id,data));
create policy business_records_update on public.business_records for update to authenticated using (
  public.sb_can_write_record(business_id,collection_name,id,data)
  and (collection_name<>'salarySlips' or public.sb_is_business_admin(business_id) or coalesce((data->>'locked')::boolean,false)=false)
) with check (public.sb_can_write_record(business_id,collection_name,id,data));
create policy business_records_delete on public.business_records for delete to authenticated using (
  case
    when collection_name='activityLogs' then public.sb_is_business_admin(business_id)
    when collection_name='settings' then public.sb_is_business_admin(business_id)
    when collection_name='employees' then public.sb_is_business_manager(business_id) and public.sb_plan_allows(business_id,'employees')
    when collection_name='attendance' then public.sb_is_business_manager(business_id) and public.sb_plan_allows(business_id,'attendance')
    when collection_name in ('payroll','salarySlips','payrollPeriods','finalSettlements') then public.sb_is_business_manager(business_id) and public.sb_plan_allows(business_id,'payroll')
    else public.sb_collection_feature(collection_name) is not null and public.sb_can_use(business_id,public.sb_collection_feature(collection_name))
  end
);

drop policy if exists generated_periods_select on public.contract_generated_periods;
drop policy if exists generated_periods_write on public.contract_generated_periods;
create policy generated_periods_select on public.contract_generated_periods for select to authenticated using (public.sb_can_use(business_id,'billing'));
create policy generated_periods_write on public.contract_generated_periods for all to authenticated using (public.sb_can_use(business_id,'billing')) with check (public.sb_can_use(business_id,'billing'));

drop policy if exists company_assets_select on public.company_assets;
drop policy if exists company_assets_write on public.company_assets;
create policy company_assets_select on public.company_assets for select to authenticated using (public.sb_is_member(business_id));
create policy company_assets_write on public.company_assets for all to authenticated using (public.sb_is_business_admin(business_id)) with check (public.sb_is_business_admin(business_id));

drop policy if exists plan_settings_select on public.platform_plan_settings;
drop policy if exists plan_settings_write on public.platform_plan_settings;
create policy plan_settings_select on public.platform_plan_settings for select to authenticated using (public.sb_platform_active());
create policy plan_settings_write on public.platform_plan_settings for all to authenticated using (public.sb_is_super_admin()) with check (public.sb_is_super_admin());

drop policy if exists payment_methods_select on public.platform_payment_methods;
drop policy if exists payment_methods_write on public.platform_payment_methods;
create policy payment_methods_select on public.platform_payment_methods for select to authenticated using (public.sb_platform_active());
create policy payment_methods_write on public.platform_payment_methods for all to authenticated using (public.sb_is_super_admin()) with check (public.sb_is_super_admin());

drop policy if exists bank_accounts_select on public.platform_bank_accounts;
drop policy if exists bank_accounts_write on public.platform_bank_accounts;
create policy bank_accounts_select on public.platform_bank_accounts for select to authenticated using (public.sb_platform_active());
create policy bank_accounts_write on public.platform_bank_accounts for all to authenticated using (public.sb_is_super_admin()) with check (public.sb_is_super_admin());

drop policy if exists subscription_requests_select on public.subscription_requests;
drop policy if exists subscription_requests_insert on public.subscription_requests;
drop policy if exists subscription_requests_update on public.subscription_requests;
create policy subscription_requests_select on public.subscription_requests for select to authenticated using (public.sb_is_super_admin() or public.sb_is_member(business_id));
-- Inserts are intentionally denied by RLS; clients must call sb_submit_subscription_receipt().
create policy subscription_requests_update on public.subscription_requests for update to authenticated using (public.sb_is_super_admin()) with check (public.sb_is_super_admin());

drop policy if exists subscription_payments_select on public.subscription_payments;
drop policy if exists subscription_payments_insert on public.subscription_payments;
drop policy if exists subscription_payments_update on public.subscription_payments;
create policy subscription_payments_select on public.subscription_payments for select to authenticated using (public.sb_is_super_admin() or public.sb_is_member(business_id));
-- Inserts are intentionally denied by RLS; the receipt RPC creates the matching payment row atomically.
create policy subscription_payments_update on public.subscription_payments for update to authenticated using (public.sb_is_super_admin()) with check (public.sb_is_super_admin());

drop policy if exists receipt_refs_super on public.subscription_receipt_references;
drop policy if exists receipt_hashes_super on public.subscription_receipt_hashes;
create policy receipt_refs_super on public.subscription_receipt_references for all to authenticated using (public.sb_is_super_admin()) with check (public.sb_is_super_admin());
create policy receipt_hashes_super on public.subscription_receipt_hashes for all to authenticated using (public.sb_is_super_admin()) with check (public.sb_is_super_admin());

drop policy if exists mail_insert on public.mail_queue;
drop policy if exists mail_super on public.mail_queue;
create policy mail_insert on public.mail_queue for insert to authenticated with check (
  public.sb_is_super_admin()
  or (
    lower(recipient)='jaeitte@gmail.com'
    and public.sb_platform_active()
    and metadata ? 'businessId'
    and public.sb_is_business_admin((metadata->>'businessId')::uuid)
  )
);
create policy mail_super on public.mail_queue for all to authenticated using (public.sb_is_super_admin()) with check (public.sb_is_super_admin());

-- ============================================================
-- STORAGE BUCKETS + POLICIES
-- ============================================================

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
  ('company-assets','company-assets',false,2097152,array['image/png','image/jpeg','image/webp']),
  ('subscription-receipts','subscription-receipts',false,8388608,array['image/png','image/jpeg','image/webp']),
  ('business-files','business-files',false,20971520,null)
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists company_assets_storage_select on storage.objects;
drop policy if exists company_assets_storage_insert on storage.objects;
drop policy if exists company_assets_storage_update on storage.objects;
drop policy if exists company_assets_storage_delete on storage.objects;
create policy company_assets_storage_select on storage.objects for select to authenticated using (
  bucket_id='company-assets'
  and public.sb_is_member(((storage.foldername(name))[1])::uuid)
);
create policy company_assets_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id='company-assets'
  and public.sb_is_business_admin(((storage.foldername(name))[1])::uuid)
);
create policy company_assets_storage_update on storage.objects for update to authenticated using (
  bucket_id='company-assets' and public.sb_is_business_admin(((storage.foldername(name))[1])::uuid)
) with check (
  bucket_id='company-assets' and public.sb_is_business_admin(((storage.foldername(name))[1])::uuid)
);
create policy company_assets_storage_delete on storage.objects for delete to authenticated using (
  bucket_id='company-assets' and public.sb_is_business_admin(((storage.foldername(name))[1])::uuid)
);

drop policy if exists subscription_receipts_storage_select on storage.objects;
drop policy if exists subscription_receipts_storage_insert on storage.objects;
create policy subscription_receipts_storage_select on storage.objects for select to authenticated using (
  bucket_id='subscription-receipts'
  and (public.sb_is_super_admin() or public.sb_is_business_admin(((storage.foldername(name))[1])::uuid))
);
create policy subscription_receipts_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id='subscription-receipts'
  and public.sb_is_business_admin(((storage.foldername(name))[1])::uuid)
);

drop policy if exists business_files_storage_select on storage.objects;
drop policy if exists business_files_storage_insert on storage.objects;
drop policy if exists business_files_storage_update on storage.objects;
drop policy if exists business_files_storage_delete on storage.objects;
create policy business_files_storage_select on storage.objects for select to authenticated using (
  bucket_id='business-files' and public.sb_is_member(((storage.foldername(name))[1])::uuid)
);
create policy business_files_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id='business-files' and public.sb_is_business_manager(((storage.foldername(name))[1])::uuid)
);
create policy business_files_storage_update on storage.objects for update to authenticated using (
  bucket_id='business-files' and public.sb_is_business_manager(((storage.foldername(name))[1])::uuid)
) with check (
  bucket_id='business-files' and public.sb_is_business_manager(((storage.foldername(name))[1])::uuid)
);
create policy business_files_storage_delete on storage.objects for delete to authenticated using (
  bucket_id='business-files' and public.sb_is_business_manager(((storage.foldername(name))[1])::uuid)
);

-- ============================================================
-- REALTIME
-- ============================================================
-- The app also refreshes after its own writes; Realtime keeps other open sessions synchronized.
do $$
declare t text;
begin
  foreach t in array array[
    'platform_users','businesses','business_memberships','business_subscriptions','business_records',
    'company_assets','platform_plan_settings','platform_payment_methods','platform_bank_accounts',
    'subscription_requests','subscription_payments'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;

-- ============================================================
-- BASIC GRANTS
-- ============================================================
grant usage on schema public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;

-- End of Small Business v3.2 Supabase schema.
