import { createClient } from '@supabase/supabase-js';

const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const publishableKey = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || '',
).trim();

const missing = [];
if (!url) missing.push('VITE_SUPABASE_URL');
if (!publishableKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');

export const configurationError = missing.length
  ? `Missing environment values: ${missing.join(', ')}`
  : '';

export const supabase = createClient(url || 'https://example.supabase.co', publishableKey || 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const SUPER_ADMIN_EMAIL = String(
  import.meta.env.VITE_SUPER_ADMIN_EMAIL
  || import.meta.env.VITE_OWNER_EMAIL
  || 'jaeitte@gmail.com',
).trim().toLowerCase();

export const OWNER_EMAIL = SUPER_ADMIN_EMAIL;

// Still used only for the optional Google Drive integration.
export const GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

export const currentAuthUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user || null;
};
