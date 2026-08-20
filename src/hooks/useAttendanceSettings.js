import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';

export const defaultAttendanceSettings = {
  shifts: [
    { id: 'morning', name: 'Morning', startTime: '08:00', endTime: '16:00', active: true, isDefault: true },
    { id: 'evening', name: 'Evening', startTime: '16:00', endTime: '00:00', active: true, isDefault: false },
    { id: 'night', name: 'Night', startTime: '00:00', endTime: '08:00', active: true, isDefault: false },
  ],
};

export function useAttendanceSettings(enabled = true, businessId = '') {
  const [settings, setSettings] = useState(defaultAttendanceSettings);

  useEffect(() => {
    let channel = null;
    let cancelled = false;

    if (!enabled || !businessId) {
      setSettings(defaultAttendanceSettings);
      return undefined;
    }

    const load = async () => {
      const { data, error } = await supabase
        .from('business_records')
        .select('data')
        .eq('business_id', businessId)
        .eq('collection_name', 'settings')
        .eq('id', 'attendance')
        .maybeSingle();
      if (!error && !cancelled) setSettings({ ...defaultAttendanceSettings, ...(data?.data || {}) });
    };

    load();
    channel = supabase
      .channel(`sb-attendance-settings-${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_records', filter: `business_id=eq.${businessId}` }, (payload) => {
        const row = payload.new || payload.old;
        if (row?.collection_name === 'settings' && row?.id === 'attendance') load();
      })
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, businessId]);

  return settings;
}
