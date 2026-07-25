import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

export const defaultSettings = {
  businessName: 'Dhinasha Family 7',
  shortName: 'DF7',
  address: "Male', Maldives",
  phone: '',
  email: '',
  currency: 'MVR',
  invoicePrefix: 'INV',
  quotePrefix: 'QTN',
  driveRootFolder: 'DF7 Business',
};

export function useSettings(enabled = true) {
  const [settings, setSettings] = useState(defaultSettings);
  useEffect(() => {
    if (!enabled) {
      setSettings(defaultSettings);
      return undefined;
    }
    return onSnapshot(doc(db, 'settings', 'business'), (snapshot) => {
      setSettings(snapshot.exists() ? { ...defaultSettings, ...snapshot.data() } : defaultSettings);
    });
  }, [enabled]);
  return settings;
}
