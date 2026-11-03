import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where, limit, Timestamp, type Query } from 'firebase/firestore';
import { db } from './firebase';
import type { AlertDoc, Client, Shift, UserProfile } from './types';

function useLive<T>(q: () => Query): T[] {
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => onSnapshot(q(), (s) => setRows(s.docs.map((d) => ({ ...d.data(), id: d.id }) as T)), () => {}), []); // eslint-disable-line react-hooks/exhaustive-deps
  return rows;
}

// Sorted in the app, not the database: client names are sensitive and must not be indexed.
export const useClients = () =>
  [...useLive<Client>(() => query(collection(db, 'clients')))].sort((a, b) => a.name.localeCompare(b.name));
export const useStaff = () => useLive<UserProfile & { id: string }>(() => query(collection(db, 'users'), orderBy('name')));
export const useOpenAlerts = () =>
  useLive<AlertDoc>(() => query(collection(db, 'alerts'), where('resolved', '==', false), limit(50)));

/** Shifts starting in [from, to). Single-field range on `start`, so no composite index is needed. */
export const useShiftsBetween = (from: Date, to: Date) => {
  const a = from.getTime(), b = to.getTime();
  const [rows, setRows] = useState<Shift[]>([]);
  useEffect(() => onSnapshot(
    query(collection(db, 'shifts'), where('start', '>=', Timestamp.fromMillis(a)), where('start', '<', Timestamp.fromMillis(b))),
    (snap) => setRows(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Shift)), () => {},
  ), [a, b]);
  return rows;
};
