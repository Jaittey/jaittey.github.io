-- Small Business v4.2.1
-- Employee registration fix WITHOUT Supabase Edge Functions.
--
-- Safe additive migration for the existing business_memberships schema.
-- This does NOT create company_users.
-- This does NOT replace your current tenant RLS policies.

-- ============================================================
-- 1. Anonymous pre-check
-- ============================================================
--
-- Returns only {allowed, reason}. It does not expose business/company data.
-- The employee must match an Administrator-created, active membership whose
-- user_id is still NULL.

create or replace function public.sb_employee_registration_check(
  p_email text,
  p_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_name text;
  v_has_pending_email boolean := false;
  v_has_name_match boolean := false;
  v_already_activated boolean := false;
begin
  v_email := lower(
    regexp_replace(
      trim(coalesce(p_email, '')),
      '[[:space:]]+',
      '',
      'g'
    )
  );

  v_name := lower(
    regexp_replace(
      trim(coalesce(p_display_name, '')),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );

  if v_email = '' or v_name = '' then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'INVALID_INPUT'
    );
  end if;

  select exists (
    select 1
    from public.business_memberships m
    where lower(
      regexp_replace(
        trim(coalesce(m.email, '')),
        '[[:space:]]+',
        '',
        'g'
      )
    ) = v_email
      and m.active = true
      and m.user_id is not null
  )
  into v_already_activated;

  if v_already_activated then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'ALREADY_ACTIVATED'
    );
  end if;

  select exists (
    select 1
    from public.business_memberships m
    where lower(
      regexp_replace(
        trim(coalesce(m.email, '')),
        '[[:space:]]+',
        '',
        'g'
      )
    ) = v_email
      and m.active = true
      and m.user_id is null
  )
  into v_has_pending_email;

  if not v_has_pending_email then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'NOT_INVITED'
    );
  end if;

  select exists (
    select 1
    from public.business_memberships m
    where lower(
      regexp_replace(
        trim(coalesce(m.email, '')),
        '[[:space:]]+',
        '',
        'g'
      )
    ) = v_email
      and lower(
        regexp_replace(
          trim(coalesce(m.display_name, '')),
          '[[:space:]]+',
          ' ',
          'g'
        )
      ) = v_name
      and m.active = true
      and m.user_id is null
  )
  into v_has_name_match;

  if not v_has_name_match then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'NAME_MISMATCH'
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'reason', 'OK'
  );
end;
$$;

revoke all
on function public.sb_employee_registration_check(text, text)
from public;

grant execute
on function public.sb_employee_registration_check(text, text)
to anon, authenticated;

-- ============================================================
-- 2. Make sure membership claiming is present and executable
-- ============================================================

create or replace function public.sb_claim_membership()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    return;
  end if;

  update public.business_memberships
     set user_id = (select auth.uid()),
         updated_at = now()
   where lower(trim(email)) = lower(
           coalesce(auth.jwt() ->> 'email', '')
         )
     and active = true
     and (
       user_id is null
       or user_id = (select auth.uid())
     );
end;
$$;

revoke all
on function public.sb_claim_membership()
from public;

grant execute
on function public.sb_claim_membership()
to authenticated;

-- ============================================================
-- 3. Useful index for employee registration lookup
-- ============================================================

create index if not exists business_memberships_pending_email_idx
  on public.business_memberships (lower(email))
  where active = true and user_id is null;
