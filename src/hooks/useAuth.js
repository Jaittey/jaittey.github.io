import { useEffect, useState } from 'react';
import { supabase, SUPER_ADMIN_EMAIL } from '../config/supabase';

const lower = (value = '') => String(value || '').trim().toLowerCase();

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

  // Safely attaches a pre-created email membership to this Supabase Auth user.
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
      // Avoid doing database work synchronously inside the auth callback.
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
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: lower(email),
        password,
      });
      if (authError) throw authError;
    } catch (reason) {
      setError(reason?.message || 'Email sign-in failed.');
    }
  };

  const registerEmail = async (email, password, displayName) => {
    setError('');
    try {
      const { error: authError } = await supabase.auth.signUp({
        email: lower(email),
        password,
        options: {
          data: {
            full_name: String(displayName || '').trim(),
          },
        },
      });
      if (authError) throw authError;
    } catch (reason) {
      setError(reason?.message || 'Account registration failed.');
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
