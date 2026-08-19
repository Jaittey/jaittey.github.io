-- Small Business HTML v4.1 database compatibility check
-- READ-ONLY. Safe to run in Supabase SQL Editor.

select
  to_regclass('public.platform_users') as platform_users,
  to_regclass('public.businesses') as businesses,
  to_regclass('public.business_memberships') as business_memberships,
  to_regclass('public.business_subscriptions') as business_subscriptions,
  to_regclass('public.business_records') as business_records,
  to_regclass('public.company_assets') as company_assets,
  to_regclass('public.subscription_requests') as subscription_requests,
  to_regclass('public.subscription_payments') as subscription_payments;

select proname
from pg_proc
where proname in (
  'sb_claim_membership',
  'sb_register_business',
  'sb_complete_pos_sale',
  'sb_save_invoice_with_stock',
  'sb_receive_invoice_payment',
  'sb_process_final_settlement'
)
order by proname;

select id, name, public
from storage.buckets
where id in ('company-assets','subscription-receipts','business-files')
order by id;
