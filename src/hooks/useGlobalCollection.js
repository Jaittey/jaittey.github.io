import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { mapPlatformRow, ORDER_FIELD_ALIASES, TABLE_ALIASES } from '../services/supabaseMapping';

export function useGlobalCollection(name, orderField = '', enabled = true) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState('');

  useEffect(() => {
    let channel = null;
    let cancelled = false;

    if (!enabled) {
      setItems([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    const table = TABLE_ALIASES[name] || name;
    const dbOrder = ORDER_FIELD_ALIASES[name]?.[orderField] || orderField;

    const load = async () => {
      setLoading(true);
      let query = supabase.from(table).select('*');
      if (dbOrder) query = query.order(dbOrder, { ascending: false, nullsFirst: false });
      const { data, error: queryError } = await query;

      if (queryError) {
        if (!cancelled) {
          setItems([]);
          setError(queryError.message || `Could not load ${name}.`);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setItems((data || []).map((row) => mapPlatformRow(name, row)));
        setError('');
        setLoading(false);
      }
    };

    load();
    channel = supabase
      .channel(`sb-global-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, load)
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [name, orderField, enabled]);

  return { items, loading, error };
}
