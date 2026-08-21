-- Small Business Suite 1.0
-- Standalone test-data deletion hotfix.
-- Safe to run after Suite 1.0 is already installed.

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
    delete from public.business_records
      where collection_name not in ('settings', 'posProfiles');
    get diagnostics v_deleted_records = row_count;

    delete from public.contract_generated_periods where true;
    get diagnostics v_deleted_periods = row_count;

  elsif v_scope in ('COMPANY_DATA', 'ALL_TEST_DATA') then
    delete from public.business_records where true;
    get diagnostics v_deleted_records = row_count;

    delete from public.contract_generated_periods where true;
    get diagnostics v_deleted_periods = row_count;

    delete from public.company_assets where true;
    get diagnostics v_deleted_assets = row_count;
  end if;

  if v_scope = 'ALL_TEST_DATA' then
    delete from public.subscription_receipt_references where true;
    get diagnostics v_deleted_receipt_refs = row_count;

    delete from public.subscription_receipt_hashes where true;
    get diagnostics v_deleted_receipt_hashes = row_count;

    delete from public.subscription_payments where true;
    get diagnostics v_deleted_payments = row_count;

    delete from public.subscription_requests where true;
    get diagnostics v_deleted_requests = row_count;

    delete from public.mail_queue where true;
    get diagnostics v_deleted_mail = row_count;

    delete from public.company_user_activation_attempts where true;
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
