-- Small Business (SB) v3.3.0 upgrade
-- Run this once in Supabase SQL Editor on an existing v3.2 database.

begin;

-- 1) Flexible subscription periods.
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid='public.business_subscriptions'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%billing_period%' loop
    execute format('alter table public.business_subscriptions drop constraint %I',c.conname);
  end loop;
  for c in select conname from pg_constraint where conrelid='public.subscription_requests'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%billing_period%' loop
    execute format('alter table public.subscription_requests drop constraint %I',c.conname);
  end loop;
end $$;

alter table public.business_subscriptions
  add constraint business_subscriptions_billing_period_check check (billing_period in ('MONTHLY','YEARLY','TRIAL','CUSTOM'));
alter table public.subscription_requests
  add constraint subscription_requests_billing_period_check check (billing_period in ('MONTHLY','YEARLY','CUSTOM'));

-- 2) Custom offers.
create table if not exists public.platform_custom_offers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  plan_id text not null check (plan_id in ('SILVER','GOLD','PLATINUM')),
  price numeric(14,2) not null default 0,
  currency text not null default 'MVR',
  duration_type text not null check (duration_type in ('DAYS','MONTHS','YEARS','LIFETIME')),
  duration_value integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (duration_type='LIFETIME' or duration_value>0)
);

alter table public.business_subscriptions add column if not exists offer_id uuid references public.platform_custom_offers(id) on delete set null;
alter table public.business_subscriptions add column if not exists offer_name text not null default '';
alter table public.business_subscriptions add column if not exists duration_type text not null default '';
alter table public.business_subscriptions add column if not exists duration_value integer not null default 0;

alter table public.subscription_requests add column if not exists offer_id uuid references public.platform_custom_offers(id) on delete set null;
alter table public.subscription_requests add column if not exists offer_name text not null default '';
alter table public.subscription_requests add column if not exists duration_type text not null default '';
alter table public.subscription_requests add column if not exists duration_value integer not null default 0;

alter table public.subscription_payments add column if not exists offer_id uuid references public.platform_custom_offers(id) on delete set null;
alter table public.subscription_payments add column if not exists offer_name text not null default '';
alter table public.subscription_payments add column if not exists duration_type text not null default '';
alter table public.subscription_payments add column if not exists duration_value integer not null default 0;

alter table public.platform_custom_offers enable row level security;
drop policy if exists platform_custom_offers_select on public.platform_custom_offers;
drop policy if exists platform_custom_offers_write on public.platform_custom_offers;
create policy platform_custom_offers_select on public.platform_custom_offers for select to authenticated using (true);
create policy platform_custom_offers_write on public.platform_custom_offers for all to authenticated using (public.sb_is_super_admin()) with check (public.sb_is_super_admin());

-- 3) New registrations receive a 7-day Platinum trial (Founder remains complimentary).
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
  if exists(select 1 from public.businesses where owner_id=uid) then raise exception 'Each Small Business account can register only one owned business.'; end if;

  insert into public.businesses(id,name,legal_name,registration_number,address,phone,email,currency,industry,owner_id,owner_email,status)
  values (bid,bname,coalesce(p_form->>'legalName',bname),coalesce(p_form->>'registrationNumber',''),coalesce(p_form->>'address',''),coalesce(p_form->>'phone',''),coalesce(p_form->>'email',em),upper(coalesce(nullif(p_form->>'currency',''),'MVR')),coalesce(p_form->>'industry',''),uid,em,'ACTIVE');

  insert into public.business_memberships(business_id,email,user_id,business_name,display_name,role,active,custom_permissions,permissions)
  values (bid,em,uid,bname,coalesce((select display_name from public.platform_users where id=uid),''),'administrator',true,false,array['*']::text[]);

  insert into public.business_records(business_id,collection_name,id,data)
  values (bid,'settings','business',jsonb_build_object('businessName',bname,'shortName',coalesce(nullif(p_form->>'shortName',''),left(bname,12)),'address',coalesce(p_form->>'address',''),'phone',coalesce(p_form->>'phone',''),'email',coalesce(p_form->>'email',em),'currency',upper(coalesce(nullif(p_form->>'currency',''),'MVR')),'registrationNumber',coalesce(p_form->>'registrationNumber',''),'driveRootFolder','Small Business - '||bname||' - '||left(bid::text,6),'createdAt',now(),'updatedAt',now()));

  if em='jaeitte@gmail.com' then
    insert into public.business_subscriptions(business_id,business_name,plan_id,plan_name,status,billing_period,amount,currency,starts_at,ends_at,approved_at,approved_by,complimentary)
    values (bid,bname,'PLATINUM','Founder Platinum','ACTIVE','CUSTOM',0,'MVR',now(),null,now(),em,true)
    on conflict (business_id) do update set plan_id='PLATINUM',plan_name='Founder Platinum',status='ACTIVE',billing_period='CUSTOM',ends_at=null,complimentary=true,updated_at=now();
  else
    insert into public.business_subscriptions(business_id,business_name,plan_id,plan_name,status,billing_period,amount,currency,starts_at,ends_at,approved_at,approved_by,complimentary)
    values (bid,bname,'PLATINUM','7-Day Free Trial','ACTIVE','TRIAL',0,'MVR',now(),now()+interval '7 days',now(),'SYSTEM',true)
    on conflict (business_id) do update set plan_id='PLATINUM',plan_name='7-Day Free Trial',status='ACTIVE',billing_period='TRIAL',starts_at=now(),ends_at=now()+interval '7 days',complimentary=true,updated_at=now();
  end if;
  return bid;
end;
$$;

-- Give existing businesses a 7-day trial only when they do not currently have a valid ACTIVE subscription.
insert into public.business_subscriptions(
  business_id,business_name,plan_id,plan_name,status,billing_period,amount,currency,starts_at,ends_at,approved_at,approved_by,complimentary
)
select b.id,b.name,'PLATINUM','7-Day Free Trial','ACTIVE','TRIAL',0,'MVR',now(),now()+interval '7 days',now(),'SYSTEM',true
from public.businesses b
where lower(b.owner_email) <> 'jaeitte@gmail.com'
  and not exists (
    select 1 from public.business_subscriptions s
    where s.business_id=b.id
      and s.status='ACTIVE'
      and (s.ends_at is null or s.ends_at>now())
  )
on conflict (business_id) do update set
  plan_id='PLATINUM',plan_name='7-Day Free Trial',status='ACTIVE',billing_period='TRIAL',amount=0,currency='MVR',
  starts_at=now(),ends_at=now()+interval '7 days',approved_at=now(),approved_by='SYSTEM',complimentary=true,updated_at=now()
where public.business_subscriptions.status <> 'ACTIVE'
   or (public.business_subscriptions.ends_at is not null and public.business_subscriptions.ends_at<=now());

-- 4) Duplicate check: exact image fingerprint only.
create or replace function public.sb_find_duplicate_receipt(p_business_id uuid,p_bank_id text,p_reference text,p_file_hash text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb:='[]'::jsonb;
begin
  if not public.sb_is_business_admin(p_business_id) then raise exception 'Company Administrator access required.'; end if;
  if coalesce(p_file_hash,'')<>'' and exists(select 1 from public.subscription_receipt_hashes h where h.receipt_file_hash=p_file_hash) then
    result:=result||jsonb_build_array(jsonb_build_object('type','FILE_HASH'));
  end if;
  return result;
end;
$$;

-- 5) Payment submission: always accepted for manual review; only amount and exact duplicate are flagged.
create or replace function public.sb_submit_subscription_receipt(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  bid uuid := (p_payload->>'business_id')::uuid;
  rid uuid := gen_random_uuid();
  selected_bank text := upper(coalesce(p_payload->>'bank_id',''));
  hash text := coalesce(p_payload->>'receipt_file_hash','');
  storage_path text := coalesce(p_payload->>'receipt_storage_path','');
  billing text := upper(coalesce(p_payload->>'billing_period','MONTHLY'));
  selected_plan text := upper(coalesce(p_payload->>'plan_id',''));
  requested_offer uuid := nullif(p_payload->>'offer_id','')::uuid;
  issues jsonb := coalesce(p_payload->'receipt_warnings','[]'::jsonb);
  duplicate_hash boolean := false;
  expected_amount numeric := 0;
  v_detected_amount numeric := coalesce(nullif(p_payload->>'detected_amount','')::numeric,0);
  selected_currency text := 'MVR';
  selected_plan_name text := coalesce(p_payload->>'plan_name','');
  selected_offer_name text := '';
  selected_duration_type text := '';
  selected_duration_value integer := 0;
  bank_row public.platform_bank_accounts%rowtype;
  plan_row public.platform_plan_settings%rowtype;
  offer_row public.platform_custom_offers%rowtype;
begin
  if not public.sb_is_business_admin(bid) then raise exception 'Only the Company Administrator can submit a subscription.'; end if;
  if lower(coalesce(p_payload->>'requester_email',''))<>public.sb_email() then raise exception 'Requester identity does not match the signed-in account.'; end if;
  if selected_bank not in ('BML','MIB') then raise exception 'Unsupported subscription bank.'; end if;
  if exists(select 1 from public.subscription_requests sr where sr.business_id=bid and sr.status in ('PENDING_VERIFICATION','MORE_INFO_REQUIRED')) then raise exception 'This business already has a subscription request waiting for verification.'; end if;

  if requested_offer is not null then
    select * into offer_row from public.platform_custom_offers o where o.id=requested_offer and o.active=true;
    if not found then raise exception 'The selected custom offer is no longer available.'; end if;
    selected_plan:=offer_row.plan_id; selected_plan_name:=offer_row.name||' · '||offer_row.plan_id; selected_offer_name:=offer_row.name;
    selected_duration_type:=offer_row.duration_type; selected_duration_value:=offer_row.duration_value; expected_amount:=offer_row.price; selected_currency:=offer_row.currency; billing:='CUSTOM';
  else
    if billing not in ('MONTHLY','YEARLY') then raise exception 'Billing period must be MONTHLY or YEARLY.'; end if;
    if selected_plan not in ('SILVER','GOLD','PLATINUM') then raise exception 'Unsupported subscription package.'; end if;
    select * into plan_row from public.platform_plan_settings p where p.plan_id=selected_plan and p.active=true;
    if not found then raise exception 'The selected subscription package is not active.'; end if;
    expected_amount:=case when billing='YEARLY' then plan_row.yearly_price else plan_row.monthly_price end; selected_currency:=plan_row.currency;
  end if;
  if expected_amount<=0 then raise exception 'The selected subscription price has not been configured.'; end if;
  select * into bank_row from public.platform_bank_accounts b where b.bank_id=selected_bank and b.active=true;
  if not found then raise exception 'The selected bank-transfer account is not active.'; end if;
  if storage_path='' or position(bid::text||'/' in storage_path)<>1 then raise exception 'Uploaded receipt path is invalid for this business.'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='subscription-receipts' and o.name=storage_path) then raise exception 'Uploaded receipt file could not be verified in storage.'; end if;

  duplicate_hash:=hash<>'' and exists(select 1 from public.subscription_receipt_hashes h where h.receipt_file_hash=hash);
  if duplicate_hash then issues:=issues||jsonb_build_array('Possible duplicate: this exact slip image has already been submitted.'); end if;
  if v_detected_amount<=0 then issues:=issues||jsonb_build_array('Transferred amount could not be detected automatically.');
  elsif abs(v_detected_amount-expected_amount)>0.01 then issues:=issues||jsonb_build_array('Detected amount does not match the selected subscription amount.'); end if;

  insert into public.subscription_requests(id,request_id,business_id,business_name,plan_id,plan_name,billing_period,offer_id,offer_name,duration_type,duration_value,amount,currency,bank_id,bank_name,destination_account_number,destination_account_name,detected_amount,ocr_confidence,ocr_text,receipt_file_hash,receipt_storage_path,receipt_file_name,receipt_file_type,receipt_risk_level,receipt_warnings,auto_reject_reasons,requester_id,requester_email,requester_name,status,verification_status,submitted_at,created_at,updated_at)
  values(rid,rid,bid,coalesce(p_payload->>'business_name',''),selected_plan,selected_plan_name,billing,requested_offer,selected_offer_name,selected_duration_type,selected_duration_value,expected_amount,selected_currency,selected_bank,bank_row.name,bank_row.account_number,bank_row.account_name,v_detected_amount,coalesce(nullif(p_payload->>'ocr_confidence','')::numeric,0),coalesce(p_payload->>'ocr_text',''),hash,storage_path,coalesce(p_payload->>'receipt_file_name',''),coalesce(p_payload->>'receipt_file_type',''),case when jsonb_array_length(issues)>0 then 'REVIEW' else 'LOW' end,issues,'[]'::jsonb,(select auth.uid()),public.sb_email(),coalesce(p_payload->>'requester_name',''),'PENDING_VERIFICATION','PENDING',now(),now(),now());

  insert into public.subscription_payments(id,request_id,business_id,business_name,plan_id,plan_name,billing_period,offer_id,offer_name,duration_type,duration_value,amount,currency,bank_id,bank_name,destination_account_number,destination_account_name,detected_amount,ocr_confidence,ocr_text,receipt_file_hash,receipt_storage_path,receipt_file_name,receipt_file_type,receipt_risk_level,receipt_warnings,auto_reject_reasons,requester_id,requester_email,requester_name,status,verification_status,payment_status,submitted_at,created_at,updated_at)
  select sr.id,sr.request_id,sr.business_id,sr.business_name,sr.plan_id,sr.plan_name,sr.billing_period,sr.offer_id,sr.offer_name,sr.duration_type,sr.duration_value,sr.amount,sr.currency,sr.bank_id,sr.bank_name,sr.destination_account_number,sr.destination_account_name,sr.detected_amount,sr.ocr_confidence,sr.ocr_text,sr.receipt_file_hash,sr.receipt_storage_path,sr.receipt_file_name,sr.receipt_file_type,sr.receipt_risk_level,sr.receipt_warnings,sr.auto_reject_reasons,sr.requester_id,sr.requester_email,sr.requester_name,sr.status,sr.verification_status,'PENDING_VERIFICATION',sr.submitted_at,sr.created_at,sr.updated_at from public.subscription_requests sr where sr.id=rid;

  if not duplicate_hash and hash<>'' then insert into public.subscription_receipt_hashes(receipt_file_hash,business_id,request_id) values(hash,bid,rid) on conflict(receipt_file_hash) do nothing; end if;
  insert into public.mail_queue(recipient,subject,body_text,metadata) values('jaeitte@gmail.com',case when jsonb_array_length(issues)>0 then 'SB payment slip needs review' else 'New SB subscription payment' end,'Business: '||coalesce(p_payload->>'business_name','')||E'\nSubscription: '||selected_plan_name||E'\nExpected amount: '||selected_currency||' '||expected_amount::text||E'\nDetected amount: '||v_detected_amount::text||E'\nBank: '||selected_bank||E'\nIssues: '||issues::text||E'\nStatus: PENDING_VERIFICATION',jsonb_build_object('type','SUBSCRIPTION_REQUEST','businessId',bid::text,'subscriptionRequestId',rid::text,'hasIssues',jsonb_array_length(issues)>0));
  return jsonb_build_object('id',rid,'status','PENDING_VERIFICATION','issues',issues);
end;
$$;

-- 6) Super Admin can approve every slip, including duplicates/mismatches/fakes.
create or replace function public.sb_review_subscription_request(p_request_id uuid,p_action text,p_notes text default '',p_starts_at date default null,p_ends_at date default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.subscription_requests%rowtype; start_ts timestamptz; end_ts timestamptz;
begin
  if not public.sb_is_super_admin() then raise exception 'Super Admin access required.'; end if;
  select * into r from public.subscription_requests sr where sr.id=p_request_id for update;
  if not found then raise exception 'Subscription request not found.'; end if;
  if upper(p_action)='APPROVE' then
    start_ts:=coalesce(p_starts_at::timestamptz,now());
    if p_ends_at is not null then end_ts:=p_ends_at::timestamptz;
    elsif r.billing_period='YEARLY' then end_ts:=start_ts+interval '1 year';
    elsif r.billing_period='MONTHLY' then end_ts:=start_ts+interval '1 month';
    elsif r.billing_period='CUSTOM' and r.duration_type='LIFETIME' then end_ts:=null;
    elsif r.billing_period='CUSTOM' and r.duration_type='DAYS' then end_ts:=start_ts+(r.duration_value*interval '1 day');
    elsif r.billing_period='CUSTOM' and r.duration_type='MONTHS' then end_ts:=start_ts+make_interval(months=>r.duration_value);
    elsif r.billing_period='CUSTOM' and r.duration_type='YEARS' then end_ts:=start_ts+make_interval(years=>r.duration_value);
    else end_ts:=start_ts+interval '1 month'; end if;
    insert into public.business_subscriptions(business_id,business_name,plan_id,plan_name,status,billing_period,offer_id,offer_name,duration_type,duration_value,amount,currency,starts_at,ends_at,approved_at,approved_by,verification_notes,complimentary,updated_at)
    values(r.business_id,r.business_name,r.plan_id,r.plan_name,'ACTIVE',r.billing_period,r.offer_id,r.offer_name,r.duration_type,r.duration_value,r.amount,r.currency,start_ts,end_ts,now(),public.sb_email(),coalesce(p_notes,''),false,now())
    on conflict(business_id) do update set business_name=excluded.business_name,plan_id=excluded.plan_id,plan_name=excluded.plan_name,status='ACTIVE',billing_period=excluded.billing_period,offer_id=excluded.offer_id,offer_name=excluded.offer_name,duration_type=excluded.duration_type,duration_value=excluded.duration_value,amount=excluded.amount,currency=excluded.currency,starts_at=excluded.starts_at,ends_at=excluded.ends_at,approved_at=now(),approved_by=public.sb_email(),verification_notes=excluded.verification_notes,complimentary=false,updated_at=now();
    update public.subscription_requests set status='APPROVED',verification_status='VERIFIED',approved_at=now(),approved_by=public.sb_email(),verification_notes=coalesce(p_notes,''),updated_at=now() where id=p_request_id;
    update public.subscription_payments set status='APPROVED',verification_status='VERIFIED',payment_status='VERIFIED',verified_at=now(),verified_by=public.sb_email(),updated_at=now() where id=p_request_id;
  elsif upper(p_action)='REJECT' then
    update public.subscription_requests set status='REJECTED',verification_status='REJECTED',rejection_reason=coalesce(p_notes,''),reviewed_at=now(),reviewed_by=public.sb_email(),updated_at=now() where id=p_request_id;
    update public.subscription_payments set status='REJECTED',verification_status='REJECTED',payment_status='REJECTED',rejection_reason=coalesce(p_notes,''),updated_at=now() where id=p_request_id;
  elsif upper(p_action)='MORE_INFO' then
    update public.subscription_requests set status='MORE_INFO_REQUIRED',verification_status='MORE_INFO_REQUIRED',review_message=coalesce(p_notes,''),reviewed_at=now(),reviewed_by=public.sb_email(),updated_at=now() where id=p_request_id;
  else raise exception 'Unsupported verification action.'; end if;
end;
$$;

create or replace function public.sb_set_subscription_status(p_business_id uuid,p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare s public.business_subscriptions%rowtype; new_end timestamptz;
begin
  if not public.sb_is_super_admin() then raise exception 'Super Admin access required.'; end if;
  select * into s from public.business_subscriptions bs where bs.business_id=p_business_id for update;
  if not found then raise exception 'Subscription not found.'; end if;
  if p_status='ACTIVE' and s.ends_at is not null and s.ends_at<=now() then
    if s.billing_period='YEARLY' then new_end:=now()+interval '1 year';
    elsif s.billing_period='MONTHLY' then new_end:=now()+interval '1 month';
    elsif s.billing_period='TRIAL' then new_end:=now()+interval '7 days';
    elsif s.duration_type='LIFETIME' then new_end:=null;
    elsif s.duration_type='DAYS' then new_end:=now()+(s.duration_value*interval '1 day');
    elsif s.duration_type='MONTHS' then new_end:=now()+make_interval(months=>s.duration_value);
    elsif s.duration_type='YEARS' then new_end:=now()+make_interval(years=>s.duration_value);
    else new_end:=now()+interval '1 month'; end if;
    update public.business_subscriptions set status='ACTIVE',starts_at=now(),ends_at=new_end,updated_at=now() where business_id=p_business_id;
  else update public.business_subscriptions set status=p_status,updated_at=now() where business_id=p_business_id; end if;
end;
$$;

-- Grants and Realtime for custom offers.
grant select,insert,update,delete on public.platform_custom_offers to authenticated;
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='platform_custom_offers') then
    alter publication supabase_realtime add table public.platform_custom_offers;
  end if;
end $$;

commit;
