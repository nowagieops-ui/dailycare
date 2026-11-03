import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface Prefs { push: boolean; shiftReminders: boolean; emailDigest: boolean }
const DEFAULTS: Prefs = { push: true, shiftReminders: true, emailDigest: false };

export function usePrefs(uid: string | undefined) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'userPrefs', uid), (s) => setPrefs({ ...DEFAULTS, ...(s.data() as Partial<Prefs> | undefined) }), () => {});
  }, [uid]);
  const set = (patch: Partial<Prefs>) => uid && setDoc(doc(db, 'userPrefs', uid), { ...prefs, ...patch });
  return { prefs, set };
}
