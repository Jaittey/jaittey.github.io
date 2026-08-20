import { useEffect, useRef, useState } from 'react';
import { supabase, SUPER_ADMIN_EMAIL } from '../config/supabase';

const lower = (value = '') => String(value || '').trim().toLowerCase();

const normalizeEmail = (value = '') => lower(value)
  .normalize('NFKC')
  .replace(/[\s\u200B-\u200D\u2060\uFEFF]+/g, '');

const normalizeName = (value = '') => String(value || '')
  .trim()
  .replace(/\s+/g, ' ');

const validEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

const friendlyAuthError = (reason, fallback) => {
  const message = String(reason?.message || reason || '');

  if (/invalid.*email|email.*invalid/i.test(message)) {
    return 'Enter a valid email address. Spaces are removed automatically.';
  }

  if (/invalid login credentials/i.test(message)) {
    return 'Invalid email or password.';
  }

  if (/already activated/i.test(message)) {
    return 'This employee account is already activated. Use Email sign in instead.';
  }

  if (/already.*registered|already exists|user already/i.test(message)) {
    return 'An account already uses this email. Use Email sign in, or remove the old test account from Supabase Authentication first.';
  }

  if (/not.*added|not.*invited|no pending|administrator must add/i.test(message)) {
    return 'This email has not been added by a company Administrator. Ask your Administrator to add you first.';
  }

  if (/name.*match|provided name/i.test(message)) {
    return 'The name does not match the name provided by your company Administrator.';
  }

  if (/confirm email|confirmation is enabled/i.test(message)) {
    return 'Supabase Confirm Email is still enabled. Turn it OFF in Authentication → Providers → Email, delete this test Auth user, then register again.';
  }

  if (/password/i.test(message) && /weak|short|least|8/i.test(message)) {
    return 'Use a password with at least 8 characters.';
  }

  if (/rate limit|too many/i.test(message)) {
    return 'Too many authentication attempts. Wait a few minutes or use a fresh test email.';
  }

  return message || fallback;
};

const normalizeUser = (user) => {
  if (!user) return null;
  const meta = user.user_metadata || {};

  return {
    ...user,
    uid: user.id,
    displayName: meta.full_name || meta.name || meta.display_name || '',
    photoURL: meta.avatar_url || meta.picture || '',
  };
};

async function ensurePlatformProfile(user) {
  if (!user?.id || !user?.email) return;

  const normalized = normalizeUser(user);

  const { error } = await supabase
    .from('platform_users')
    .upsert({
      id: user.id,
      email: lower(user.email),
      display_name: normalized.displayName,
      photo_url: normalized.photoURL,
      is_super_admin: lower(user.email) === SUPER_ADMIN_EMAIL,
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (error) throw error;

  const { error: claimError } = await supabase.rpc('sb_claim_membership');

  if (
    claimError
    && !String(claimError.message || '').includes('does not exist')
  ) {
    throw claimError;
  }
}

async function getPlatformProfile(userId) {
  const { data, error } = await supabase
    .from('platform_users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Prevent the temporary session created by signUp() from opening the workspace.
  // The requested workflow is Register first, then manually sign in using Email.
  const employeeRegistrationRef = useRef(false);

  useEffect(() => {
    let profileChannel = null;
    let cancelled = false;
    let sessionGeneration = 0;

    const applySession = async (session) => {
      const generation = ++sessionGeneration;
      const rawUser = session?.user || null;

      if (profileChannel) {
        await supabase.removeChannel(profileChannel);
        profileChannel = null;
      }

      if (!rawUser) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        await ensurePlatformProfile(rawUser);
        const profile = await getPlatformProfile(rawUser.id);
        const superAdmin = lower(rawUser.email) === SUPER_ADMIN_EMAIL;

        if (!superAdmin && profile?.status === 'SUSPENDED') {
          await supabase.auth.signOut();

          if (!cancelled) {
            setError(
              'This Small Business account has been suspended by the platform administrator.',
            );
            setUser(null);
            setLoading(false);
          }

          return;
        }

        if (!cancelled && generation === sessionGeneration) {
          setUser(normalizeUser(rawUser));
          setError('');
          setLoading(false);
        }

        if (cancelled || generation !== sessionGeneration) return;

        const uniqueTopic =
          `sb-platform-profile-${rawUser.id}-${generation}-${Date.now()}`;

        profileChannel = supabase
          .channel(uniqueTopic)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'platform_users',
              filter: `id=eq.${rawUser.id}`,
            },
            async (payload) => {
              if (payload.new?.status === 'SUSPENDED' && !superAdmin) {
                setError(
                  'This Small Business account has been suspended by the platform administrator.',
                );
                await supabase.auth.signOut();
              }
            },
          )
          .subscribe();
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason?.message
            || 'Could not initialize your Small Business account.',
          );
          setUser(normalizeUser(rawUser));
          setLoading(false);
        }
      }
    };

    supabase.auth.getSession().then(({ data }) => applySession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // During employee registration Supabase creates a temporary signed-in
      // session when Confirm Email is OFF. Ignore that short-lived SIGNED_IN event.
      if (employeeRegistrationRef.current && event === 'SIGNED_IN') return;

      setTimeout(() => applySession(session), 0);
    });

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();

      if (profileChannel) {
        supabase.removeChannel(profileChannel);
      }
    };
  }, []);

  const loginGoogle = async () => {
    setError('');

    try {
      const redirectTo =
        `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;

      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });

      if (authError) throw authError;
    } catch (reason) {
      setError(reason?.message || 'Google sign-in failed.');
    }
  };

  const loginEmail = async (email, password) => {
    setError('');

    try {
      const normalizedEmail = normalizeEmail(email);

      if (!validEmail(normalizedEmail)) {
        throw new Error('Invalid email address.');
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError) throw authError;

      return {
        ok: true,
        email: normalizedEmail,
      };
    } catch (reason) {
      const message = friendlyAuthError(reason, 'Email sign-in failed.');
      setError(message);

      return {
        ok: false,
        error: message,
      };
    }
  };

  // Employee registration WITHOUT an Edge Function.
  //
  // 1. Anonymous RPC verifies an Administrator already created the membership.
  // 2. Supabase Auth signUp creates the password account.
  // 3. sb_claim_membership links auth.users.id -> business_memberships.user_id.
  // 4. Sign out immediately so the employee follows the requested Email-login flow.
  const registerEmail = async (email, password, displayName) => {
    setError('');

    const normalizedEmail = normalizeEmail(email);
    const normalizedName = normalizeName(displayName);

    try {
      if (!normalizedName) {
        throw new Error(
          'Enter the name provided by your company Administrator.',
        );
      }

      if (!validEmail(normalizedEmail)) {
        throw new Error('Invalid email address.');
      }

      if (String(password || '').length < 8) {
        throw new Error(
          'Password must contain at least 8 characters.',
        );
      }

      // Check the pending Administrator-created membership BEFORE creating Auth.
      const { data: gate, error: gateError } = await supabase.rpc(
        'sb_employee_registration_check',
        {
          p_email: normalizedEmail,
          p_display_name: normalizedName,
        },
      );

      if (gateError) throw gateError;

      if (!gate?.allowed) {
        if (gate?.reason === 'ALREADY_ACTIVATED') {
          throw new Error('This employee account is already activated.');
        }

        if (gate?.reason === 'NAME_MISMATCH') {
          throw new Error(
            'The name does not match the name provided by your company Administrator.',
          );
        }

        throw new Error(
          'This email has not been added by a company Administrator.',
        );
      }

      employeeRegistrationRef.current = true;

      const { data, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: normalizedName,
            display_name: normalizedName,
            account_type: 'company_user',
          },
        },
      });

      if (authError) throw authError;

      // With Confirm Email OFF, signUp must return a session immediately.
      // If it does not, the dashboard setting is still wrong.
      if (!data?.session || !data?.user?.id) {
        throw new Error(
          'Supabase Confirm Email is enabled. Employee registration requires Confirm Email to be OFF.',
        );
      }

      const { error: claimError } = await supabase.rpc('sb_claim_membership');

      if (claimError) throw claimError;

      // Verify that at least one membership is now linked to this Auth UUID.
      const { data: linkedMemberships, error: linkReadError } = await supabase
        .from('business_memberships')
        .select('business_id,user_id,email,active')
        .eq('email', normalizedEmail)
        .eq('active', true)
        .eq('user_id', data.user.id);

      if (linkReadError) throw linkReadError;

      if (!(linkedMemberships || []).length) {
        throw new Error(
          'Employee account was created but the company membership could not be linked.',
        );
      }

      await supabase.auth.signOut();

      return {
        ok: true,
        email: normalizedEmail,
        confirmationRequired: false,
        businessCount: linkedMemberships.length,
      };
    } catch (reason) {
      // If a temporary session exists, close it before returning to the login page.
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore cleanup errors.
      }

      const message = friendlyAuthError(
        reason,
        'Employee registration failed.',
      );

      setError(message);

      return {
        ok: false,
        error: message,
      };
    } finally {
      employeeRegistrationRef.current = false;
    }
  };

  return {
    user,
    loading,
    error,
    loginGoogle,
    loginEmail,
    registerEmail,
    logout: () => supabase.auth.signOut(),
    isSuperAdmin: lower(user?.email) === SUPER_ADMIN_EMAIL,
  };
}
