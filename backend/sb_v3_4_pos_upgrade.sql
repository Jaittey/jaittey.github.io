-- ============================================================
-- Small Business v3.4 — POS System Upgrade
-- Run this ONCE in Supabase SQL Editor after the existing v3.3 schema.
-- Adds POS permission and an atomic checkout RPC.
-- ============================================================

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
    'pos','quotes','invoices','customers','products','employees','attendance','payroll','preferences'
  ]::text[]);
end;
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
    return p_permission = any(array['dashboard','pos','quotes','invoices','customers','products']::text[]);
  elsif p = 'GOLD' then
    return p_permission = any(array[
      'dashboard','pos','quotes','invoices','billing','payments','customers','contracts','statements',
      'employees','hr-records','payroll','attendance','attendance-settings','products','suppliers','assets'
    ]::text[]);
  elsif p = 'PLATINUM' then
    return p_permission = any(array[
      'dashboard','pos','quotes','invoices','billing','payments','customers','contracts','statements',
      'employees','hr-records','payroll','attendance','attendance-settings','finance','expenses','budget','tax',
      'products','suppliers','assets','reports','cloud','notifications'
    ]::text[]);
  end if;
  return false;
end;
$$;

create or replace function public.sb_complete_pos_sale(
  p_business_id uuid,
  p_invoice jsonb,
  p_payment jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  iid text := gen_random_uuid()::text;
  pid text := gen_random_uuid()::text;
  item jsonb;
  product jsonb;
  qty numeric;
  stock numeric;
  next_qty numeric;
  total numeric := coalesce(nullif(p_invoice->>'total','')::numeric,0);
  inv jsonb;
  pay jsonb;
begin
  if not public.sb_can_use(p_business_id,'pos') then
    raise exception 'POS access denied.';
  end if;
  if jsonb_array_length(coalesce(p_invoice->'items','[]'::jsonb)) = 0 then
    raise exception 'Add at least one item to the POS sale.';
  end if;
  if total <= 0 then
    raise exception 'POS sale total must be greater than zero.';
  end if;

  -- Lock and deduct each stock item before writing the sale.
  for item in select * from jsonb_array_elements(coalesce(p_invoice->'items','[]'::jsonb)) loop
    if coalesce(item->>'productId','') = '' then
      raise exception 'Every POS item must be linked to an inventory product.';
    end if;

    qty := coalesce(nullif(item->>'quantity','')::numeric,0);
    if qty <= 0 then raise exception 'POS item quantity must be greater than zero.'; end if;

    select data into product
      from public.business_records
      where business_id=p_business_id
        and collection_name='products'
        and id=item->>'productId'
      for update;

    if product is null then raise exception 'A selected POS product no longer exists.'; end if;
    stock := coalesce(nullif(product->>'quantity','')::numeric,0);
    next_qty := stock - qty;
    if next_qty < 0 then
      raise exception 'Not enough stock for %.', coalesce(product->>'name','selected product');
    end if;

    update public.business_records
      set data=jsonb_set(product,'{quantity}',to_jsonb(next_qty),true)
        || jsonb_build_object('updatedAt',now()),
          updated_at=now()
      where business_id=p_business_id
        and collection_name='products'
        and id=item->>'productId';
  end loop;

  inv := p_invoice || jsonb_build_object(
    'source','POS',
    'status','PAID',
    'amountPaid',total,
    'balanceDue',0,
    'createdAt',now(),
    'updatedAt',now()
  );

  insert into public.business_records(business_id,collection_name,id,data,created_at,updated_at)
  values(p_business_id,'invoices',iid,inv,now(),now());

  pay := p_payment || jsonb_build_object(
    'invoiceId',iid,
    'invoiceNumber',coalesce(p_invoice->>'invoiceNumber',''),
    'customerId',coalesce(p_invoice->>'customerId',''),
    'customerName',coalesce(p_invoice->>'customerName','Walk-in Customer'),
    'amount',total,
    'source','POS',
    'createdAt',now(),
    'updatedAt',now()
  );

  insert into public.business_records(business_id,collection_name,id,data,created_at,updated_at)
  values(p_business_id,'payments',pid,pay,now(),now());

  return jsonb_build_object('invoiceId',iid,'paymentId',pid);
end;
$$;

revoke all on function public.sb_complete_pos_sale(uuid,jsonb,jsonb) from public;
grant execute on function public.sb_complete_pos_sale(uuid,jsonb,jsonb) to authenticated;
