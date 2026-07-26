import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider, OWNER_EMAIL } from '../config/firebase';

const emailId = (email = '') => email.trim().toLowerCase();

async function resolveAccess(user) {
  const email = emailId(user?.email);
  if (!email) return null;

  if (email === OWNER_EMAIL) {
    return {
      id: email,
      email,
      displayName: user.displayName || 'DF7 Administrator',
      role: 'administrator',
      active: true,
      owner: true,
    };
  }

  const snapshot = await getDoc(doc(db, 'userAccess', email));
  if (!snapshot.exists()) return null;
  const access = { id: snapshot.id, ...snapshot.data() };
  return access.active === false ? null : access;
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setLoading(true);
    try {
      if (!nextUser) {
        setUser(null);
        setAccess(null);
        return;
      }

      const nextAccess = await resolveAccess(nextUser);
      if (!nextAccess) {
        await signOut(auth);
        setError('This account has not been authorized by the DF7 administrator.');
        setUser(null);
        setAccess(null);
        return;
      }

      setUser(nextUser);
      setAccess(nextAccess);
      setError('');
    } catch (reason) {
      setError(reason?.message || 'Could not verify account access.');
      setUser(null);
      setAccess(null);
    } finally {
      setLoading(false);
    }
  }), []);

  const loginGoogle = async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (reason) {
      setError(reason?.code === 'auth/popup-closed-by-user'
        ? 'The Google sign-in window was closed.'
        : reason?.message || 'Google sign-in failed.');
    }
  };

  const loginEmail = async (email, password) => {
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (reason) {
      setError(reason?.message || 'Email sign-in failed.');
    }
  };

  const registerEmail = async (email, password, displayName) => {
    setError('');
    try {
      const normalized = emailId(email);
      const credential = await createUserWithEmailAndPassword(auth, normalized, password);
      if (displayName.trim()) {
        await updateProfile(credential.user, { displayName: displayName.trim() });
      }
    } catch (reason) {
      setError(reason?.message || 'Account registration failed.');
    }
  };

  return {
    user,
    access,
    role: access?.role || '',
    loading,
    error,
    loginGoogle,
    loginEmail,
    registerEmail,
    logout: () => signOut(auth),
  };
}
