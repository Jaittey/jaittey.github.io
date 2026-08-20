-- SMALL BUSINESS v4.2
-- Company User Login Fix
-- Run in Supabase SQL Editor.
--
-- IMPORTANT:
-- This migration assumes your current v4.x table is public.company_users.
-- It is intentionally additive and does not delete existing users.

alter table if exists public.company_users
  add column if not exists email text,
  add column if not exists display_name text,
  add column if not exists role text default 'user',
  add column if not exists status text default 'active',
  add column if not exists permissions jsonb default '[]'::jsonb,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now();

-- Normalize existing values where possible.
update public.company_users set role = lower(role) where role is not null;
update public.company_users set status = lower(status) where status is not null;

-- One Auth user can occur only once in a company.
create unique index if not exists company_users_company_user_unique
on public.company_users(company_id, user_id);

-- Prevent the same email from being added twice to one company.
create unique index if not exists company_users_company_email_unique
on public.company_users(company_id, lower(email))
where email is not null;

create index if not exists company_users_user_idx on public.company_users(user_id);
create index if not exists company_users_company_idx on public.company_users(company_id);

alter table public.company_users enable row level security;

-- Helper used by RLS. SECURITY DEFINER avoids recursive RLS checks.
create or replace function public.is_company_administrator(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_users cu
    where cu.company_id = target_company
      and cu.user_id = auth.uid()
      and lower(coalesce(cu.role,'')) = 'administrator'
      and lower(coalesce(cu.status,'active')) = 'active'
  );
$$;

revoke all on function public.is_company_administrator(uuid) from public;
grant execute on function public.is_company_administrator(uuid) to authenticated;

-- Keep reads tenant-scoped.
drop policy if exists "v42_company_users_read" on public.company_users;
create policy "v42_company_users_read"
on public.company_users
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_company_administrator(company_id)
);

-- Browser users do NOT get a broad INSERT policy here.
-- New Auth users are created only by the secured Edge Function using service role.
-- Existing v4.x policies should be reviewed after successful deployment.
