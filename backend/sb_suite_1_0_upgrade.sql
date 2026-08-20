-- ============================================================
-- SMALL BUSINESS SUITE 1.0
-- Super Admin App Settings + safer test-data cleanup
--
-- Run AFTER the existing v5.0 Commerce Suite migration.
-- This migration does not delete any data by itself.
-- ============================================================

create or replace function public.sb_super_admin_test_data_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_records bigint := 0;
  v_businesses bigint := 0;
  v_memberships bigint := 0;
  v_transactions bigint := 0;
begin
  if not public.sb_is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  select count(*) into v_records from public.business_records;
  select count(*) into v_businesses from public.businesses;
  select count(*) into v_memberships from public.business_memberships;
  select
    (select count(*) from public.subscription_requests)
    + (select count(*) from public.subscription_payments)
  into v_transactions;

  return jsonb_build_object(
    'businessRecords', v_records,
    'businesses', v_businesses,
    'memberships', v_memberships,
    'subscriptionTransactions', v_transactions
  );
end;
$$;

revoke all on function public.sb_super_admin_test_data_summary() from public;
grant execute on function public.sb_super_admin_test_data_summary() to authenticated;


create or replace function public.sb_super_admin_clear_test_data(
  p_scope text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text := upper(trim(coalesce(p_scope, '')));
  v_deleted_records bigint := 0;
  v_deleted_periods bigint := 0;
  v_deleted_assets bigint := 0;
  v_deleted_requests bigint := 0;
  v_deleted_payments bigint := 0;
  v_deleted_receipt_refs bigint := 0;
  v_deleted_receipt_hashes bigint := 0;
  v_deleted_mail bigint := 0;
  v_deleted_activation_attempts bigint := 0;
begin
  if not public.sb_is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  if coalesce(p_confirmation, '') <> 'DELETE ALL TEST DATA' then
    raise exception 'Confirmation phrase is invalid.';
  end if;

  if v_scope not in ('OPERATIONS', 'COMPANY_DATA', 'ALL_TEST_DATA') then
    raise exception 'Invalid cleanup scope.';
  end if;

  if v_scope = 'OPERATIONS' then
    -- Keep Company/System settings and the Administrator's company-wide POS setup.
    delete from public.business_records
      where collection_name not in ('settings', 'posProfiles');
    get diagnostics v_deleted_records = row_count;

    delete from public.contract_generated_periods;
    get diagnostics v_deleted_periods = row_count;

  elsif v_scope in ('COMPANY_DATA', 'ALL_TEST_DATA') then
    delete from public.business_records;
    get diagnostics v_deleted_records = row_count;

    delete from public.contract_generated_periods;
    get diagnostics v_deleted_periods = row_count;

    delete from public.company_assets;
    get diagnostics v_deleted_assets = row_count;
  end if;

  if v_scope = 'ALL_TEST_DATA' then
    -- Preserve businesses, business_memberships, business_subscriptions,
    -- platform plans, offers, bank accounts and Auth users.
    delete from public.subscription_receipt_references;
    get diagnostics v_deleted_receipt_refs = row_count;

    delete from public.subscription_receipt_hashes;
    get diagnostics v_deleted_receipt_hashes = row_count;

    delete from public.subscription_payments;
    get diagnostics v_deleted_payments = row_count;

    delete from public.subscription_requests;
    get diagnostics v_deleted_requests = row_count;

    delete from public.mail_queue;
    get diagnostics v_deleted_mail = row_count;

    delete from public.company_user_activation_attempts;
    get diagnostics v_deleted_activation_attempts = row_count;
  end if;

  return jsonb_build_object(
    'scope', v_scope,
    'businessRecordsDeleted', v_deleted_records,
    'contractPeriodsDeleted', v_deleted_periods,
    'companyAssetsDeleted', v_deleted_assets,
    'subscriptionRequestsDeleted', v_deleted_requests,
    'subscriptionPaymentsDeleted', v_deleted_payments,
    'receiptReferencesDeleted', v_deleted_receipt_refs,
    'receiptHashesDeleted', v_deleted_receipt_hashes,
    'mailQueueDeleted', v_deleted_mail,
    'activationAttemptsDeleted', v_deleted_activation_attempts,
    'preserved', jsonb_build_array(
      'auth.users',
      'platform_users',
      'businesses',
      'business_memberships',
      'business_subscriptions',
      'platform_plan_settings',
      'platform_bank_accounts',
      'platform_custom_offers'
    )
  );
end;
$$;

revoke all on function public.sb_super_admin_clear_test_data(text,text) from public;
grant execute on function public.sb_super_admin_clear_test_data(text,text) to authenticated;

-- Commerce operations must never be callable anonymously.
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array[
        'sb_adjust_stock_v5',
        'sb_complete_pos_sale_v5',
        'sb_receive_purchase_order_v5',
        'sb_fulfill_marketplace_order_v5',
        'sb_v5_update_product_stock'
      ])
  loop
    execute format('revoke execute on function %s from anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
