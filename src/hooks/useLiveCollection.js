import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';

export function useLiveCollection(name, orderField = 'createdAt', enabled = true) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      setError('');
      return undefined;
    }
    setLoading(true);
    const q = query(collection(db, name), orderBy(orderField, 'desc'));
    return onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
      setLoading(false);
      setError('');
    }, (reason) => {
      setError(reason.message || `Could not load ${name}.`);
      setLoading(false);
    });
  }, [name, orderField, enabled]);

  return { items, loading, error };
}
