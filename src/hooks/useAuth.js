import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, OWNER_EMAIL } from '../config/firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    if (nextUser && nextUser.email?.toLowerCase() !== OWNER_EMAIL) {
      await signOut(auth);
      setError('This Google account is not authorized to use DF7.');
      setUser(null);
    } else {
      setUser(nextUser);
      if (nextUser) setError('');
    }
    setLoading(false);
  }), []);

  const login = async () => {
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user.email?.toLowerCase() !== OWNER_EMAIL) {
        await signOut(auth);
        throw new Error('This Google account is not authorized to use DF7.');
      }
    } catch (reason) {
      const message = reason?.code === 'auth/popup-closed-by-user'
        ? 'The Google sign-in window was closed.'
        : reason?.message || 'Google sign-in failed.';
      setError(message);
    }
  };

  return { user, loading, error, login, logout: () => signOut(auth) };
}
