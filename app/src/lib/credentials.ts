import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from './firebase';
import type { Credential, MissedClockIn, RequiredTraining } from './types';
import { colors } from './theme';
import { stageOf, type Stage } from './expiry';

export function useCredentials(staffId?: string) {
  const [rows, setRows] = useState<Credential[]>([]);
  useEffect(() => {
    const base = collection(db, 'credentials');
    const q = staffId
      ? query(base, where('staffId', '==', staffId), orderBy('expiresOn', 'asc'))
      : query(base, orderBy('expiresOn', 'asc'), limit(300));
    return onSnapshot(q, (s) => setRows(s.docs.map((d) => ({ ...d.data(), id: d.id }) as Credential)), () => {});
  }, [staffId]);
  return rows;
}

export function useMissedRequests(opts: { staffId?: string; pendingOnly?: boolean }) {
  const [rows, setRows] = useState<MissedClockIn[]>([]);
  useEffect(() => {
    const base = collection(db, 'missedClockIns');
    const q = opts.staffId
      ? query(base, where('staffId', '==', opts.staffId), orderBy('createdAt', 'desc'), limit(30))
      : opts.pendingOnly
        ? query(base, where('status', '==', 'pending'), limit(100))
        : query(base, orderBy('createdAt', 'desc'), limit(100));
    return onSnapshot(q, (s) => setRows(s.docs.map((d) => ({ ...d.data(), id: d.id }) as MissedClockIn)), () => {});
  }, [opts.staffId, opts.pendingOnly]);
  return rows;
}

export const stageTone = (st: Stage): 'green' | 'amber' | 'red' | 'blue' =>
  st === 'ok' ? 'green' : st === 'expired' || st === 'week' ? 'red' : st === 'month' ? 'amber' : 'blue';
export { stageOf, colors };

export function useRequiredTrainings() {
  const [rows, setRows] = useState<RequiredTraining[]>([]);
  useEffect(() => onSnapshot(query(collection(db, 'trainings')),
    (s) => setRows(s.docs.map((d) => ({ ...d.data(), id: d.id }) as RequiredTraining)), () => {}), []);
  return rows;
}

/** Does this staff member hold a current credential for the required training? */
export const hasTraining = (creds: Credential[], staffId: string, t: RequiredTraining, now = Date.now()) =>
  creds.some((c) => c.staffId === staffId && c.title.trim().toLowerCase() === t.title.trim().toLowerCase() && c.expiresOn.toMillis() >= now);
