import { supabase } from '../config/supabase';

const normalizeEmail = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '');

export async function activateCompanyUser({
  displayName,
  email,
  password,
}) {
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await supabase.functions.invoke(
    'activate-company-user',
    {
      body: {
        displayName: String(displayName || '').trim(),
        email: normalizedEmail,
        password,
      },
    },
  );

  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || 'Unable to activate employee login.');

  return data;
}
