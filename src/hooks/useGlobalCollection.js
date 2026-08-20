import { useEffect, useRef, useState } from 'react';
import { supabase } from '../config/supabase';
import { mapPlatformRow, ORDER_FIELD_ALIASES, TABLE_ALIASES } from '../services/supabaseMapping';

const CACHE = new Map();
const unique = () => (
  globalThis.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`
);

export function useGlobalCollection(name, orderField = '', enabled = true) {
  const [items, setItems] = useState(() => CACHE.get(name) || []);
  const [loading, setLoading] = useState(Boolean(enabled && !CACHE.has(name)));
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    let channel = null;
    let cancelled = false;

    if (!enabled) {
      setLoading(false);
      setError('');
      return undefined;
    }

    const table = TABLE_ALIASES[name] || name;
    const dbOrder = ORDER_FIELD_ALIASES[name]?.[orderField] || orderField;
    const cached = CACHE.get(name);

    if (cached) {
      setItems(cached);
      setLoading(false);
    }

    const load = async ({ quiet = false } = {}) => {
      if (!quiet && !CACHE.has(name)) setLoading(true);
      let query = supabase.from(table).select('*');
      if (dbOrder) query = query.order(dbOrder, { ascending: false, nullsFirst: false });
      const { data, error: queryError } = await query;

      if (queryError) {
        if (!cancelled) {
          setError(queryError.message || `Could not load ${name}.`);
          setLoading(false);
        }
        return;
      }

      const next = (data || []).map((row) => mapPlatformRow(name, row));
      CACHE.set(name, next);
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
    channel = supabase
      .channel(`sb-global-${table}-${unique()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, scheduleLoad)
      .subscribe();

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [name, orderField, enabled]);

  return { items, loading, error };
}
