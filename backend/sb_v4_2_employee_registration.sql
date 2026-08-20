-- SMALL BUSINESS v4.2
-- Employee self-registration using pre-created business_memberships.
--
-- This migration DOES NOT create or replace business_memberships.
-- It DOES NOT replace your existing memberships_select/insert/update/delete policies.
-- It only creates a private rate-limit table used by the Edge Function.

create extension if not exists pgcrypto;

create table if not exists public.company_user_activation_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);

create index if not exists company_user_activation_attempts_email_time_idx
  on public.company_user_activation_attempts (lower(email), attempted_at desc);

alter table public.company_user_activation_attempts enable row level security;

-- Intentionally no anon/authenticated RLS policies.
-- The service-role Edge Function can access this table while browser clients cannot.

comment on table public.company_user_activation_attempts is
  'Private rate-limit audit for Small Business employee account activation.';
