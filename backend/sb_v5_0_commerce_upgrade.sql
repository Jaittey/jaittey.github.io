-- ============================================================
-- Small Business (SB) v5.0 — Commerce Suite Upgrade
-- Adaptive POS + procurement + marketplace + stock audit
--
-- Safe approach:
-- - Reuses the existing business_records JSON tenant store.
-- - Reuses current business_memberships / RLS architecture.
-- - Adds no new public tenant tables.
-- - Adds/updates only server-side RPC functions and permissions.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Map v5 business_records collections to subscription permissions.
-- Existing RLS policies call this function, so adding the mapping makes the
-- new collections tenant-safe without creating new public tenant tables.
-- ------------------------------------------------------------
create or replace function public.sb_collection_feature(p_collection text)
returns text
language sql
immutable
as $$
  select case p_collection
    when 'customers' then 'customers'
    when 'products' then 'products'
    when 'stockMovements' then 'products'
    when 'invoices' then 'invoices'
    when 'quotes' then 'quotes'
    when 'billingContracts' then 'billing'
    when 'payments' then 'payments'
    when 'employees' then 'employees'
    when 'hrRecords' then 'hr-records'
    when 'attendance' then 'attendance'
    when 'attendanceDocuments' then 'attendance'
    when 'payroll' then 'payroll'
    when 'salarySlips' then 'payroll'
    when 'payrollPeriods' then 'payroll'
    when 'finalSettlements' then 'payroll'
    when 'expenses' then 'expenses'
    when 'budgets' then 'budget'
    when 'suppliers' then 'suppliers'
    when 'purchaseOrders' then 'purchase-orders'
    when 'salesChannels' then 'marketplace'
    when 'marketplaceOrders' then 'marketplace'
    when 'posProfiles' then 'pos'
    when 'menuItems' then 'pos'
    when 'restaurantOrders' then 'pos'
    when 'serviceJobs' then 'pos'
    when 'assets' then 'assets'
    else null
  end;
$$;

-- ------------------------------------------------------------
-- Permissions
-- ------------------------------------------------------------
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
  select * into m
  from public.business_memberships
  where business_id = p_business_id
    and active = true
    and (user_id = (select auth.uid()) or lower(email) = public.sb_email())
  limit 1;

  if not found or not public.sb_platform_active() then return false; end if;
  if m.role = 'administrator' then return true; end if;
  if m.custom_permissions then
    -- Restaurant kitchen tickets and garage jobs share POS-owned operational
    -- records, but the frontend can still expose only the page explicitly
    -- assigned to the user.
    if p_permission = 'pos' and (
      'pos' = any(m.permissions)
      or 'kitchen' = any(m.permissions)
      or 'service-jobs' = any(m.permissions)
    ) then return true; end if;
    return p_permission = any(m.permissions);
  end if;
  if m.role = 'manager' then return true; end if;

  return p_permission = any(array[
    'dashboard','pos','quotes','invoices','customers','products',
    'employees','attendance','payroll','preferences'
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
    return p_permission = any(array[
      'dashboard','pos','quotes','invoices','customers','products'
    ]::text[]);
  elsif p = 'GOLD' then
    return p_permission = any(array[
      'dashboard','pos','quotes','invoices','billing','payments','customers','contracts','statements',
      'products','suppliers','purchase-orders','marketplace','kitchen','service-jobs','assets',
      'employees','hr-records','payroll','final-settlements','attendance','attendance-settings'
    ]::text[]);
  elsif p = 'PLATINUM' then
    return p_permission = any(array[
      'dashboard','pos','quotes','invoices','billing','payments','customers','contracts','statements',
      'products','suppliers','purchase-orders','marketplace','kitchen','service-jobs','assets',
      'employees','hr-records','payroll','final-settlements','attendance','attendance-settings',
      'finance','income-payments','expenses','budget','tax','reports','cloud','notifications'
    ]::text[]);
  end if;
  return false;
end;
$$;

-- ------------------------------------------------------------
-- Internal helpers for atomic stock updates
-- ------------------------------------------------------------
create or replace function public.sb_v5_update_product_stock(
  p_business_id uuid,
  p_product_id text,
  p_delta numeric,
  p_reason text,
  p_reference text default '',
  p_note text default ''
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  product jsonb;
  current_qty numeric;
  next_qty numeric;
  movement_id text := gen_random_uuid()::text;
begin
  select data into product
  from public.business_records
  where business_id = p_business_id
    and collection_name = 'products'
    and id = p_product_id
  for update;

  if product is null then
    raise exception 'Inventory item % no longer exists.', p_product_id;
  end if;

  if coalesce((product->>'trackStock')::boolean, true) = false then
    return coalesce(nullif(product->>'quantity','')::numeric, 0);
  end if;

  current_qty := coalesce(nullif(product->>'quantity','')::numeric, 0);
  next_qty := current_qty + coalesce(p_delta, 0);

  if next_qty < 0 then
    raise exception 'Not enough stock for %.', coalesce(product->>'name', 'selected item');
  end if;

  update public.business_records
  set data = jsonb_set(product, '{quantity}', to_jsonb(next_qty), true)
      || jsonb_build_object('updatedAt', now()),
      updated_at = now()
  where business_id = p_business_id
    and collection_name = 'products'
    and id = p_product_id;

  insert into public.business_records(
    business_id, collection_name, id, data, created_at, updated_at
  ) values (
    p_business_id,
    'stockMovements',
    movement_id,
    jsonb_build_object(
      'productId', p_product_id,
      'productName', coalesce(product->>'name', ''),
      'sku', coalesce(product->>'sku', ''),
      'change', p_delta,
      'quantityBefore', current_qty,
      'quantityAfter', next_qty,
      'reason', coalesce(p_reason, 'Stock adjustment'),
      'reference', coalesce(p_reference, ''),
      'note', coalesce(p_note, ''),
      'createdAt', now(),
      'updatedAt', now()
    ),
    now(), now()
  );

  return next_qty;
end;
$$;

revoke all on function public.sb_v5_update_product_stock(uuid,text,numeric,text,text,text) from public;

-- ------------------------------------------------------------
-- Manual inventory adjustment
-- ------------------------------------------------------------
create or replace function public.sb_adjust_stock_v5(
  p_business_id uuid,
  p_product_id text,
  p_delta numeric,
  p_reason text default 'Manual adjustment',
  p_note text default ''
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sb_can_use(p_business_id, 'products') then
    raise exception 'Inventory access denied.';
  end if;

  if coalesce(p_delta, 0) = 0 then
    raise exception 'Stock change cannot be zero.';
  end if;

  return public.sb_v5_update_product_stock(
    p_business_id, p_product_id, p_delta, p_reason, 'MANUAL', p_note
  );
end;
$$;

revoke all on function public.sb_adjust_stock_v5(uuid,text,numeric,text,text) from public;
grant execute on function public.sb_adjust_stock_v5(uuid,text,numeric,text,text) to authenticated;

-- ------------------------------------------------------------
-- Adaptive POS checkout
-- Supports:
-- - retail goods
-- - wholesale goods
-- - garage parts + non-stock service/labour lines
-- - restaurant menu items with ingredient recipe stockImpacts
-- ------------------------------------------------------------
create or replace function public.sb_complete_pos_sale_v5(
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
  impact jsonb;
  impacts jsonb;
  total numeric := coalesce(nullif(p_invoice->>'total','')::numeric, 0);
  qty numeric;
  product_id text;
  inv jsonb;
  pay jsonb;
  payment_amount numeric := coalesce(nullif(p_payment->>'amount','')::numeric, total);
begin
  if not public.sb_can_use(p_business_id, 'pos') then
    raise exception 'POS access denied.';
  end if;

  if jsonb_array_length(coalesce(p_invoice->'items','[]'::jsonb)) = 0 then
    raise exception 'Add at least one item to the POS sale.';
  end if;

  if total <= 0 then
    raise exception 'POS sale total must be greater than zero.';
  end if;

  for item in
    select * from jsonb_array_elements(coalesce(p_invoice->'items','[]'::jsonb))
  loop
    impacts := coalesce(item->'stockImpacts', '[]'::jsonb);

    -- Backward-compatible fallback for simple retail products.
    if jsonb_array_length(impacts) = 0
       and coalesce(item->>'productId','') <> ''
       and coalesce((item->>'trackStock')::boolean, true) = true then
      impacts := jsonb_build_array(jsonb_build_object(
        'productId', item->>'productId',
        'quantity', coalesce(nullif(item->>'quantity','')::numeric, 0)
      ));
    end if;

    for impact in select * from jsonb_array_elements(impacts)
    loop
      product_id := coalesce(impact->>'productId', '');
      qty := coalesce(nullif(impact->>'quantity','')::numeric, 0);

      if product_id <> '' and qty > 0 then
        perform public.sb_v5_update_product_stock(
          p_business_id,
          product_id,
          -qty,
          'POS sale',
          coalesce(p_invoice->>'invoiceNumber',''),
          coalesce(item->>'name','')
        );
      end if;
    end loop;
  end loop;

  inv := p_invoice || jsonb_build_object(
    'source', coalesce(nullif(p_invoice->>'source',''), 'POS'),
    'status', coalesce(nullif(p_invoice->>'status',''), 'PAID'),
    'amountPaid', payment_amount,
    'balanceDue', greatest(0, total - payment_amount),
    'createdAt', now(),
    'updatedAt', now()
  );

  insert into public.business_records(
    business_id, collection_name, id, data, created_at, updated_at
  ) values (
    p_business_id, 'invoices', iid, inv, now(), now()
  );

  if payment_amount > 0 then
    pay := p_payment || jsonb_build_object(
      'invoiceId', iid,
      'invoiceNumber', coalesce(p_invoice->>'invoiceNumber',''),
      'customerId', coalesce(p_invoice->>'customerId',''),
      'customerName', coalesce(p_invoice->>'customerName','Walk-in Customer'),
      'amount', payment_amount,
      'source', coalesce(nullif(p_invoice->>'source',''), 'POS'),
      'createdAt', now(),
      'updatedAt', now()
    );

    insert into public.business_records(
      business_id, collection_name, id, data, created_at, updated_at
    ) values (
      p_business_id, 'payments', pid, pay, now(), now()
    );
  end if;

  return jsonb_build_object('invoiceId', iid, 'paymentId', case when payment_amount > 0 then pid else null end);
end;
$$;

revoke all on function public.sb_complete_pos_sale_v5(uuid,jsonb,jsonb) from public;
grant execute on function public.sb_complete_pos_sale_v5(uuid,jsonb,jsonb) to authenticated;

-- ------------------------------------------------------------
-- Purchase order receiving (supports partial shipments)
-- ------------------------------------------------------------
create or replace function public.sb_receive_purchase_order_v5(
  p_business_id uuid,
  p_purchase_order_id text,
  p_receipt jsonb,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  po jsonb;
  po_item jsonb;
  receipt_line jsonb;
  new_items jsonb := '[]'::jsonb;
  product_id text;
  ordered_qty numeric;
  received_qty numeric;
  receive_now numeric;
  matched_receive numeric;
  all_received boolean := true;
  any_received boolean := false;
  next_status text;
begin
  if not public.sb_can_use(p_business_id, 'purchase-orders') then
    raise exception 'Purchase order access denied.';
  end if;

  select data into po
  from public.business_records
  where business_id = p_business_id
    and collection_name = 'purchaseOrders'
    and id = p_purchase_order_id
  for update;

  if po is null then raise exception 'Purchase order not found.'; end if;
  if upper(coalesce(po->>'status','')) = 'CANCELLED' then raise exception 'Cancelled purchase orders cannot be received.'; end if;

  for po_item in select * from jsonb_array_elements(coalesce(po->'items','[]'::jsonb))
  loop
    product_id := coalesce(po_item->>'productId','');
    ordered_qty := coalesce(nullif(po_item->>'orderedQty','')::numeric, nullif(po_item->>'quantity','')::numeric, 0);
    received_qty := coalesce(nullif(po_item->>'receivedQty','')::numeric, 0);
    matched_receive := 0;

    for receipt_line in select * from jsonb_array_elements(coalesce(p_receipt,'[]'::jsonb))
    loop
      if coalesce(receipt_line->>'productId','') = product_id then
        matched_receive := matched_receive + coalesce(nullif(receipt_line->>'quantity','')::numeric, 0);
      end if;
    end loop;

    receive_now := greatest(0, matched_receive);

    if received_qty + receive_now > ordered_qty then
      raise exception 'Received quantity exceeds ordered quantity for %.', coalesce(po_item->>'name', product_id);
    end if;

    if receive_now > 0 then
      any_received := true;
      perform public.sb_v5_update_product_stock(
        p_business_id,
        product_id,
        receive_now,
        'Purchase order receipt',
        coalesce(po->>'poNumber', p_purchase_order_id),
        p_note
      );
    end if;

    received_qty := received_qty + receive_now;
    if received_qty < ordered_qty then all_received := false; end if;

    new_items := new_items || jsonb_build_array(
      po_item || jsonb_build_object('receivedQty', received_qty)
    );
  end loop;

  if not any_received then
    raise exception 'Enter at least one quantity to receive.';
  end if;

  next_status := case when all_received then 'RECEIVED' else 'PARTIAL' end;

  po := po
    || jsonb_build_object(
      'items', new_items,
      'status', next_status,
      'lastReceivedAt', now(),
      'updatedAt', now()
    )
    || jsonb_build_object(
      'receiptLog', coalesce(po->'receiptLog','[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'receivedAt', now(),
          'note', coalesce(p_note,''),
          'lines', p_receipt
        ))
    );

  update public.business_records
  set data = po, updated_at = now()
  where business_id = p_business_id
    and collection_name = 'purchaseOrders'
    and id = p_purchase_order_id;

  return po;
end;
$$;

revoke all on function public.sb_receive_purchase_order_v5(uuid,text,jsonb,text) from public;
grant execute on function public.sb_receive_purchase_order_v5(uuid,text,jsonb,text) to authenticated;

-- ------------------------------------------------------------
-- Marketplace fulfillment
-- ------------------------------------------------------------
create or replace function public.sb_fulfill_marketplace_order_v5(
  p_business_id uuid,
  p_order_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ord jsonb;
  item jsonb;
  iid text := gen_random_uuid()::text;
  pid text := gen_random_uuid()::text;
  invoice jsonb;
  payment jsonb;
  product_id text;
  qty numeric;
  total numeric;
begin
  if not public.sb_can_use(p_business_id, 'marketplace') then
    raise exception 'Marketplace order access denied.';
  end if;

  select data into ord
  from public.business_records
  where business_id = p_business_id
    and collection_name = 'marketplaceOrders'
    and id = p_order_id
  for update;

  if ord is null then raise exception 'Marketplace order not found.'; end if;
  if upper(coalesce(ord->>'status','')) = 'FULFILLED' then raise exception 'This order is already fulfilled.'; end if;
  if upper(coalesce(ord->>'status','')) = 'CANCELLED' then raise exception 'Cancelled orders cannot be fulfilled.'; end if;

  for item in select * from jsonb_array_elements(coalesce(ord->'items','[]'::jsonb))
  loop
    product_id := coalesce(item->>'productId','');
    qty := coalesce(nullif(item->>'quantity','')::numeric, 0);
    if product_id <> '' and qty > 0 then
      perform public.sb_v5_update_product_stock(
        p_business_id,
        product_id,
        -qty,
        'Marketplace fulfillment',
        coalesce(ord->>'orderNumber', p_order_id),
        coalesce(ord->>'channelName', ord->>'channel', 'Marketplace')
      );
    end if;
  end loop;

  total := coalesce(nullif(ord->>'total','')::numeric, 0);
  invoice := jsonb_build_object(
    'invoiceNumber', coalesce(ord->>'orderNumber', 'WEB-' || upper(substr(iid,1,8))),
    'source', 'MARKETPLACE',
    'channel', coalesce(ord->>'channelName', ord->>'channel', 'Marketplace'),
    'status', case when upper(coalesce(ord->>'paymentStatus','PAID')) = 'PAID' then 'PAID' else 'UNPAID' end,
    'amountPaid', case when upper(coalesce(ord->>'paymentStatus','PAID')) = 'PAID' then total else 0 end,
    'balanceDue', case when upper(coalesce(ord->>'paymentStatus','PAID')) = 'PAID' then 0 else total end,
    'customerId', coalesce(ord->>'customerId',''),
    'customerName', coalesce(ord->>'customerName','Online Customer'),
    'items', coalesce(ord->'items','[]'::jsonb),
    'subtotal', coalesce(nullif(ord->>'subtotal','')::numeric, total),
    'total', total,
    'date', to_char(current_date, 'YYYY-MM-DD'),
    'createdAt', now(),
    'updatedAt', now()
  );

  insert into public.business_records(
    business_id, collection_name, id, data, created_at, updated_at
  ) values (
    p_business_id, 'invoices', iid, invoice, now(), now()
  );

  if upper(coalesce(ord->>'paymentStatus','PAID')) = 'PAID' and total > 0 then
    payment := jsonb_build_object(
      'invoiceId', iid,
      'invoiceNumber', coalesce(ord->>'orderNumber',''),
      'customerId', coalesce(ord->>'customerId',''),
      'customerName', coalesce(ord->>'customerName','Online Customer'),
      'amount', total,
      'paymentMethod', coalesce(ord->>'paymentMethod', ord->>'channelName', 'Marketplace'),
      'paymentReference', coalesce(ord->>'paymentReference',''),
      'paymentDate', to_char(current_date, 'YYYY-MM-DD'),
      'status', 'PAID',
      'source', 'MARKETPLACE',
      'createdAt', now(),
      'updatedAt', now()
    );
    insert into public.business_records(
      business_id, collection_name, id, data, created_at, updated_at
    ) values (
      p_business_id, 'payments', pid, payment, now(), now()
    );
  end if;

  ord := ord || jsonb_build_object(
    'status','FULFILLED',
    'fulfilledAt',now(),
    'invoiceId',iid,
    'updatedAt',now()
  );

  update public.business_records
  set data = ord, updated_at = now()
  where business_id = p_business_id
    and collection_name = 'marketplaceOrders'
    and id = p_order_id;

  return jsonb_build_object('orderId', p_order_id, 'invoiceId', iid);
end;
$$;

revoke all on function public.sb_fulfill_marketplace_order_v5(uuid,text) from public;
grant execute on function public.sb_fulfill_marketplace_order_v5(uuid,text) to authenticated;
