import { useEffect, useRef, useState } from 'react';
import { supabase } from '../config/supabase';
import { mapSubscriptionRow } from '../services/supabaseMapping';

const CACHE = new Map();
const unique = () => (
  globalThis.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`
);

export function useSubscriptionRequests(businessId = '', isSuperAdmin = false, enabled = true) {
  const cacheKey = isSuperAdmin ? 'all' : businessId;
  const [items, setItems] = useState(() => CACHE.get(cacheKey) || []);
  const [loading, setLoading] = useState(Boolean(enabled && !CACHE.has(cacheKey)));
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    let channel = null;
    let cancelled = false;

    if (!enabled || (!isSuperAdmin && !businessId)) {
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

      let query = supabase
        .from('subscription_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isSuperAdmin) query = query.eq('business_id', businessId);

      const { data, error: queryError } = await query;
      if (queryError) {
        if (!cancelled) {
          setError(queryError.message || 'Could not load subscription requests.');
          setLoading(false);
        }
        return;
      }

      const next = (data || []).map(mapSubscriptionRow);
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
    channel = supabase
      .channel(`sb-subscription-requests-${cacheKey}-${unique()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscription_requests' },
        (payload) => {
          if (isSuperAdmin || payload.new?.business_id === businessId || payload.old?.business_id === businessId) {
            scheduleLoad();
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [businessId, isSuperAdmin, enabled, cacheKey]);

  return { items, loading, error };
}
