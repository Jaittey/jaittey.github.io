import { supabase } from '../config/supabase';

export async function getSuiteDataSummary() {
  const { data, error } = await supabase.rpc('sb_super_admin_test_data_summary');
  if (error) throw error;
  return data || {};
}

export async function clearSuiteTestData(scope, confirmation) {
  const { data, error } = await supabase.rpc('sb_super_admin_clear_test_data', {
    p_scope: String(scope || 'OPERATIONS').toUpperCase(),
    p_confirmation: String(confirmation || ''),
  });
  if (error) throw error;
  return data || {};
}
