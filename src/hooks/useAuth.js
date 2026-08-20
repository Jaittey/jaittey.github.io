import { useEffect, useState } from 'react';
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

  if (/already activated|already.*registered|already exists|user already/i.test(message)) {
    return 'This employee account is already activated. Use Email sign in instead.';
  }

  if (/not.*added|not.*invited|no pending|company administrator/i.test(message)) {
    return 'This email has not been added by a company Administrator. Ask your Administrator to add you first.';
  }

  if (/name.*match|provided name/i.test(message)) {
    return 'The name does not match the name provided by your company Administrator.';
  }

  if (/password/i.test(message) && /weak|short|least|8/i.test(message)) {
    return 'Use a password with at least 8 characters.';
  }

  if (/rate limit|too many/i.test(message)) {
    return 'Too many registration attempts. Please wait a few minutes and try again.';
  }

  if (/function.*not found|failed to send|edge function/i.test(message)) {
    return 'Employee registration service is not available yet. Ask the Administrator to contact support.';
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

  // Backward compatibility: if an older pending membership exists for the same
  // email, this existing RPC can attach it after login.
  const { error: claimError } = await supabase.rpc('sb_claim_membership');
  if (claimError && !String(claimError.message || '').includes('does not exist')) {
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
            setError('This Small Business account has been suspended by the platform administrator.');
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

        const uniqueTopic = `sb-platform-profile-${rawUser.id}-${generation}-${Date.now()}`;

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
                setError('This Small Business account has been suspended by the platform administrator.');
                await supabase.auth.signOut();
              }
            },
          )
          .subscribe();
      } catch (reason) {
        if (!cancelled) {
          setError(reason?.message || 'Could not initialize your Small Business account.');
          setUser(normalizeUser(rawUser));
          setLoading(false);
        }
      }
    };

    supabase.auth.getSession().then(({ data }) => applySession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => applySession(session), 0);
    });

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
      if (profileChannel) supabase.removeChannel(profileChannel);
    };
  }, []);

  const loginGoogle = async () => {
    setError('');

    try {
      const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;

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
      if (!validEmail(normalizedEmail)) throw new Error('Invalid email address.');

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (authError) throw authError;
      return { ok: true, email: normalizedEmail };
    } catch (reason) {
      const message = friendlyAuthError(reason, 'Email sign-in failed.');
      setError(message);
      return { ok: false, error: message };
    }
  };

  // IMPORTANT:
  // Register is no longer public Supabase signUp.
  // It activates a membership pre-created by the company Administrator.
  const registerEmail = async (email, password, displayName) => {
    setError('');

    try {
      const normalizedEmail = normalizeEmail(email);
      const normalizedName = normalizeName(displayName);

      if (!normalizedName) throw new Error('Enter the name provided by your company Administrator.');
      if (!validEmail(normalizedEmail)) throw new Error('Invalid email address.');
      if (String(password || '').length < 8) {
        throw new Error('Password must contain at least 8 characters.');
      }

      const { data, error: invokeError } = await supabase.functions.invoke(
        'activate-company-user',
        {
          body: {
            email: normalizedEmail,
            displayName: normalizedName,
            password,
          },
        },
      );

      if (invokeError) throw invokeError;
      if (!data?.ok) throw new Error(data?.error || 'Employee registration failed.');

      return {
        ok: true,
        email: normalizedEmail,
        confirmationRequired: false,
        businessCount: Number(data.businessCount || 1),
      };
    } catch (reason) {
      const message = friendlyAuthError(reason, 'Employee registration failed.');
      setError(message);
      return { ok: false, error: message };
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
