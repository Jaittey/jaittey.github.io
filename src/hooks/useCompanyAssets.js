import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

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

export function useCompanyAssets(enabled = true) {
  const [assets, setAssets] = useState(emptyAssets);

  useEffect(() => {
    if (!enabled) {
      setAssets(emptyAssets);
      return undefined;
    }

    return onSnapshot(collection(db, 'companyAssets'), (snapshot) => {
      const next = { ...emptyAssets };
      snapshot.docs.forEach((document) => {
        const field = fieldById[document.id];
        if (field) next[field] = document.data()?.dataUrl || '';
      });
      setAssets(next);
    });
  }, [enabled]);

  return assets;
}
