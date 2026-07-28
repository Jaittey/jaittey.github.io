import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, OWNER_EMAIL } from '../config/firebase';
import { normalizeRole } from '../config/erp';

const emailId = (email = '') => email.trim().toLowerCase();

const normalizedAccess = (id, data = {}) => ({
  id,
  ...data,
  email: emailId(data.email || id),
  role: normalizeRole(data.role),
  active: data.active !== false,
  customPermissions: Boolean(data.customPermissions),
  permissions: Array.isArray(data.permissions) ? data.permissions : [],
});

export function useAuth() {
  const [user, setUser] = useState(null);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let stopAccess = () => {};

    const stopAuth = onAuthStateChanged(auth, (nextUser) => {
      stopAccess();
      stopAccess = () => {};
      setLoading(true);

      if (!nextUser) {
        setUser(null);
        setAccess(null);
        setLoading(false);
        return;
      }

      const email = emailId(nextUser.email);
      if (!email) {
        setError('The signed-in account does not contain an email address.');
        setUser(null);
        setAccess(null);
        setLoading(false);
        return;
      }

      if (email === OWNER_EMAIL) {
        setUser(nextUser);
        setAccess({
          id: email,
          email,
          displayName: nextUser.displayName || 'DF7 Administrator',
          role: 'administrator',
          active: true,
          owner: true,
          customPermissions: false,
          permissions: ['*'],
        });
        setError('');
        setLoading(false);
        return;
      }

      stopAccess = onSnapshot(
        doc(db, 'userAccess', email),
        async (snapshot) => {
          if (!snapshot.exists() || snapshot.data().active === false) {
            await signOut(auth);
            setError('This account has not been authorized by the DF7 administrator.');
            setUser(null);
            setAccess(null);
            setLoading(false);
            return;
          }

          setUser(nextUser);
          setAccess(normalizedAccess(snapshot.id, snapshot.data()));
          setError('');
          setLoading(false);
        },
        async (reason) => {
          await signOut(auth);
          setError(reason?.message || 'Could not verify account access.');
          setUser(null);
          setAccess(null);
          setLoading(false);
        },
      );
    });

    return () => {
      stopAccess();
      stopAuth();
    };
  }, []);

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
      const credential = await createUserWithEmailAndPassword(
        auth,
        emailId(email),
        password,
      );
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
