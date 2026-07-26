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
  salarySlipPrefix: 'PAY',
  employeePrefix: 'EMP',
  driveRootFolder: 'DF7 Business',
  registrationNumber: '',
  tin: '',
  gstRegistered: false,
  defaultGstRate: 0,
  defaultDiscountRate: 0,
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  authorizedSignatory: '',
  designation: '',
  quotationValidityDays: 30,
  defaultTerms: 'Payment is due within the stated payment period.',
  quotationDeclaration: 'We confirm that the information and pricing in this quotation are accurate and valid for the stated validity period.',
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
