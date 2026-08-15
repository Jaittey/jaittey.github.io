import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../config/supabase';
import { mapMembershipRow, mapPlatformRow } from '../services/supabaseMapping';
import { setActiveBusinessContext } from '../services/tenantContext';

const lower = (value = '') => String(value || '').trim().toLowerCase();

export function useWorkspace(user) {
  const [memberships, setMemberships] = useState([]);
  const [activeBusinessId, setActiveBusinessIdState] = useState('');
  const [business, setBusiness] = useState(null);
  const [subscription, setSubscription] = useState({ status: 'NONE', planId: '' });
  const [loading, setLoading] = useState(Boolean(user));
  const [ownedBusinessId, setOwnedBusinessId] = useState('');
  const [error, setError] = useState('');
  const email = lower(user?.email);

  useEffect(() => {
    let channel = null;
    let cancelled = false;

    if (!user || !email) {
      setMemberships([]);
      setActiveBusinessIdState('');
      setBusiness(null);
      setSubscription({ status: 'NONE', planId: '' });
      setActiveBusinessContext(null);
      setOwnedBusinessId('');
      setLoading(false);
      return undefined;
    }

    const loadMemberships = async () => {
      setLoading(true);

      const [{ data, error: queryError }, { data: ownedRows, error: ownerError }] = await Promise.all([
        supabase
          .from('business_memberships')
          .select('*')
          .eq('email', email)
          .eq('active', true),
        supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', user.id)
          .limit(1),
      ]);

      if (!cancelled) setOwnedBusinessId(ownerError ? '' : (ownedRows?.[0]?.id || ''));

      /* membership query result continues below */
      const membershipResult = { data, error: queryError };
      const { data: membershipRows, error: membershipError } = membershipResult;
      if (membershipError) {
        if (!cancelled) {
          setMemberships([]);
          setError(membershipError.message || 'Could not load your business workspace.');
          setLoading(false);
        }
        return;
      }

      const next = (membershipRows || []).map(mapMembershipRow).filter((item) => item.businessId);
      if (!cancelled) {
        setMemberships(next);
        const stored = localStorage.getItem('sb-active-business') || localStorage.getItem('df7-active-business') || '';
        const selected = next.some((item) => item.businessId === stored)
          ? stored
          : next[0]?.businessId || '';
        setActiveBusinessIdState((current) => (
          next.some((item) => item.businessId === current) ? current : selected
        ));
        setError('');
        setLoading(false);
      }
    };

    /* legacy duplicate query block removed during Supabase migration. */

    loadMemberships();

    channel = supabase
      .channel(`sb-memberships-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'business_memberships', filter: `email=eq.${email}` },
        loadMemberships,
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, email]);

  useEffect(() => {
    let businessChannel = null;
    let subscriptionChannel = null;
    let cancelled = false;

    if (!activeBusinessId) {
      setBusiness(null);
      setSubscription({ status: 'NONE', planId: '' });
      setActiveBusinessContext(null);
      return undefined;
    }

    localStorage.setItem('sb-active-business', activeBusinessId);

    const loadBusiness = async () => {
      const { data, error: queryError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', activeBusinessId)
        .maybeSingle();
      if (queryError) return setError(queryError.message || 'Could not load the business workspace.');
      if (!cancelled) {
        const next = mapPlatformRow('businesses', data);
        setBusiness(next);
        setActiveBusinessContext(next);
      }
    };

    const loadSubscription = async () => {
      const { data, error: queryError } = await supabase
        .from('business_subscriptions')
        .select('*')
        .eq('business_id', activeBusinessId)
        .maybeSingle();
      if (queryError) return setError(queryError.message || 'Could not load the subscription.');
      if (!cancelled) {
        setSubscription(data
          ? mapPlatformRow('businessSubscriptions', data)
          : { status: 'NONE', planId: '' });
      }
    };

    loadBusiness();
    loadSubscription();

    businessChannel = supabase
      .channel(`sb-business-${activeBusinessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses', filter: `id=eq.${activeBusinessId}` }, loadBusiness)
      .subscribe();

    subscriptionChannel = supabase
      .channel(`sb-subscription-${activeBusinessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_subscriptions', filter: `business_id=eq.${activeBusinessId}` }, loadSubscription)
      .subscribe();

    return () => {
      cancelled = true;
      if (businessChannel) supabase.removeChannel(businessChannel);
      if (subscriptionChannel) supabase.removeChannel(subscriptionChannel);
    };
  }, [activeBusinessId]);

  const membership = useMemo(
    () => memberships.find((item) => item.businessId === activeBusinessId) || null,
    [memberships, activeBusinessId],
  );

  const selectBusiness = (businessId) => {
    if (memberships.some((item) => item.businessId === businessId)) {
      setActiveBusinessIdState(businessId);
    }
  };

  return {
    memberships,
    membership,
    activeBusinessId,
    business,
    subscription,
    loading,
    error,
    ownedBusinessId,
    selectBusiness,
  };
}
