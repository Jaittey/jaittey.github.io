import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';

export const defaultSettings = {
  businessName: 'Small Business',
  shortName: 'SB',
  address: '',
  phone: '',
  email: '',
  registrationNumber: '',
  tin: '',
  gstRegistered: false,
  defaultGstRate: 0,
  defaultDiscountRate: 0,
  quotationValidityDays: 30,
  currency: 'MVR',
  invoicePrefix: 'INV',
  quotePrefix: 'QTN',
  employeePrefix: 'EMP',
  salarySlipPrefix: 'PAY',
  authorizedSignatory: '',
  designation: '',
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  defaultTerms: 'Payment is due within the stated payment period.',
  quotationDeclaration: 'We confirm that the information and pricing in this quotation are accurate and valid for the stated validity period.',
  driveRootFolder: 'Small Business',
  defaultTheme: 'royal',
};

export function useSettings(enabled = true, businessId = '') {
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    let channel = null;
    let cancelled = false;

    if (!enabled || !businessId) {
      setSettings(defaultSettings);
      return undefined;
    }

    const load = async () => {
      const { data, error } = await supabase
        .from('business_records')
        .select('data')
        .eq('business_id', businessId)
        .eq('collection_name', 'settings')
        .eq('id', 'business')
        .maybeSingle();
      if (!error && !cancelled) setSettings({ ...defaultSettings, ...(data?.data || {}) });
    };

    load();
    channel = supabase
      .channel(`sb-settings-${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_records', filter: `business_id=eq.${businessId}` }, (payload) => {
        const row = payload.new || payload.old;
        if (row?.collection_name === 'settings' && row?.id === 'business') load();
      })
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, businessId]);

  return settings;
}
