import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { registerForPush } from './push';
import type { UserProfile } from './types';

interface AuthState {
  loading: boolean;
  profile: UserProfile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  loading: true,
  profile: null,
  signIn: async () => {},
  signOutUser: async () => {},
});

export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubProfile?.();
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      // The role lives in Firestore (users/{uid}), written only by admins.
      unsubProfile = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          const data = snap.data();
          setProfile(data && data.active !== false ? ({ ...data, uid: user.uid } as UserProfile) : null);
          setLoading(false);
        },
        () => {
          setProfile(null);
          setLoading(false);
        },
      );
    });
    return () => {
      unsubProfile?.();
      unsubAuth();
    };
  }, []);

  const uid = profile?.uid;
  useEffect(() => {
    if (uid) registerForPush(uid);
  }, [uid]);

  const value: AuthState = {
    loading,
    profile,
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    signOutUser: () => signOut(auth),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
