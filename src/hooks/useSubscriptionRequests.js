import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { mapSubscriptionRow } from '../services/supabaseMapping';

export function useSubscriptionRequests(businessId = '', isSuperAdmin = false, enabled = true) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState('');

  useEffect(() => {
    let channel = null;
    let cancelled = false;

    if (!enabled || (!isSuperAdmin && !businessId)) {
      setItems([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    const load = async () => {
      setLoading(true);
      let query = supabase
        .from('subscription_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (!isSuperAdmin) query = query.eq('business_id', businessId);

      const { data, error: queryError } = await query;
      if (queryError) {
        if (!cancelled) {
          setItems([]);
          setError(queryError.message || 'Could not load subscription requests.');
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setItems((data || []).map(mapSubscriptionRow));
        setError('');
        setLoading(false);
      }
    };

    load();
    channel = supabase
      .channel(`sb-subscription-requests-${isSuperAdmin ? 'all' : businessId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscription_requests' },
        (payload) => {
          if (isSuperAdmin || payload.new?.business_id === businessId || payload.old?.business_id === businessId) load();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [businessId, isSuperAdmin, enabled]);

  return { items, loading, error };
}
