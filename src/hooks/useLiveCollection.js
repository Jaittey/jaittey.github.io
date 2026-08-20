import { useEffect, useRef, useState } from 'react';
import { supabase } from '../config/supabase';
import { mapMembershipRow } from '../services/supabaseMapping';

const CACHE = new Map();

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

const unique = () => (
  globalThis.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`
);

export function useLiveCollection(name, orderField = 'createdAt', enabled = true, businessId = '') {
  const cacheKey = `${businessId}:${name}`;
  const [items, setItems] = useState(() => CACHE.get(cacheKey) || []);
  const [loading, setLoading] = useState(Boolean(enabled && !CACHE.has(cacheKey)));
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    let channel = null;
    let cancelled = false;

    if (!enabled || !businessId) {
      setLoading(false);
      setError('');
      return undefined;
    }

    const cached = CACHE.get(cacheKey);
    if (cached) {
      setItems(cached);
      setLoading(false);
    } else {
      setItems([]);
      setLoading(true);
    }

    const load = async ({ quiet = false } = {}) => {
      if (!quiet && !CACHE.has(cacheKey)) setLoading(true);

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
        CACHE.set(cacheKey, next);
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

      CACHE.set(cacheKey, next);
      if (!cancelled) {
        setItems(next);
        setError('');
        setLoading(false);
      }
    };

    const scheduleLoad = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => load({ quiet: true }), 100);
    };

    load({ quiet: Boolean(cached) });

    const table = name === 'userAccess' ? 'business_memberships' : 'business_records';
    const topic = `sb-records-${businessId}-${name}-${unique()}`;
    channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `business_id=eq.${businessId}` },
        (payload) => {
          if (name === 'userAccess') {
            scheduleLoad();
            return;
          }
          const changed = payload.new?.collection_name || payload.old?.collection_name;
          if (!changed || changed === name) scheduleLoad();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [name, orderField, enabled, businessId, cacheKey]);

  return { items, loading, error };
}
