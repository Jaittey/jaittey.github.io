import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';

const emptyAssets = {
  companyLogoDataUrl: '',
  companyStampDataUrl: '',
  managerSignatureDataUrl: '',
};

const fieldById = {
  companyLogo: 'companyLogoDataUrl',
  companyStamp: 'companyStampDataUrl',
  managerSignature: 'managerSignatureDataUrl',
};

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Could not read company asset.'));
  reader.readAsDataURL(blob);
});

async function loadAssetDataUrl(path) {
  const { data, error } = await supabase.storage.from('company-assets').download(path);
  if (error) throw error;
  return blobToDataUrl(data);
}

export function useCompanyAssets(enabled = true, businessId = '') {
  const [assets, setAssets] = useState(emptyAssets);

  useEffect(() => {
    let channel = null;
    let cancelled = false;

    if (!enabled || !businessId) {
      setAssets(emptyAssets);
      return undefined;
    }

    const load = async () => {
      const { data, error } = await supabase
        .from('company_assets')
        .select('*')
        .eq('business_id', businessId);
      if (error) return;

      const next = { ...emptyAssets };
      await Promise.all((data || []).map(async (row) => {
        const field = fieldById[row.asset_id];
        if (!field || !row.storage_path) return;
        try {
          next[field] = await loadAssetDataUrl(row.storage_path);
        } catch (reason) {
          console.warn('Company asset could not be loaded:', reason);
        }
      }));

      if (!cancelled) setAssets(next);
    };

    load();
    channel = supabase
      .channel(`sb-company-assets-${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_assets', filter: `business_id=eq.${businessId}` }, load)
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, businessId]);

  return assets;
}
