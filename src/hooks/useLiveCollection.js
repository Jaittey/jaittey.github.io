import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { mapMembershipRow } from '../services/supabaseMapping';

const valueTime = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const compareDescending = (a, b, field) => {
  const av = a?.[field];
  const bv = b?.[field];
  if (field.toLowerCase().includes('date') || field.toLowerCase().includes('at') || field === 'createdAt') {
    return valueTime(bv) - valueTime(av);
  }
  if (typeof av === 'number' || typeof bv === 'number') return Number(bv || 0) - Number(av || 0);
  return String(bv || '').localeCompare(String(av || ''));
};

export function useLiveCollection(name, orderField = 'createdAt', enabled = true, businessId = '') {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState('');

  useEffect(() => {
    let channel = null;
    let cancelled = false;

    if (!enabled || !businessId) {
      setItems([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    const load = async () => {
      setLoading(true);

      if (name === 'userAccess') {
        const { data, error: queryError } = await supabase
          .from('business_memberships')
          .select('*')
          .eq('business_id', businessId);
        if (queryError) {
          if (!cancelled) {
            setError(queryError.message || 'Could not load company users.');
            setLoading(false);
          }
          return;
        }
        const next = (data || []).map((row) => ({ ...mapMembershipRow(row), id: row.email }));
        if (!cancelled) {
          setItems(next);
          setError('');
          setLoading(false);
        }
        return;
      }

      const { data, error: queryError } = await supabase
        .from('business_records')
        .select('id,data,created_at,updated_at')
        .eq('business_id', businessId)
        .eq('collection_name', name);

      if (queryError) {
        if (!cancelled) {
          setError(queryError.message || `Could not load ${name}.`);
          setLoading(false);
        }
        return;
      }

      const next = (data || []).map((row) => ({
        id: row.id,
        ...(row.data || {}),
        createdAt: row.data?.createdAt || row.created_at,
        updatedAt: row.data?.updatedAt || row.updated_at,
      }));
      if (orderField) next.sort((a, b) => compareDescending(a, b, orderField));

      if (!cancelled) {
        setItems(next);
        setError('');
        setLoading(false);
      }
    };

    load();

    const table = name === 'userAccess' ? 'business_memberships' : 'business_records';
    channel = supabase
      .channel(`sb-records-${businessId}-${name}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `business_id=eq.${businessId}` },
        (payload) => {
          if (name === 'userAccess') return load();
          const changed = payload.new?.collection_name || payload.old?.collection_name;
          if (!changed || changed === name) load();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [name, orderField, enabled, businessId]);

  return { items, loading, error };
}
