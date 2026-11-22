import { useEffect, useState } from 'react';
import {
  addDoc, collection, doc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where, type Query,
} from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile } from './types';

export interface Unit { id: string; name: string; type: 'home' | 'apartment'; address: string; notes: string; active: boolean }
export type LogKind = 'hot_water' | 'fridge' | 'emergency_box';
export interface UnitLog {
  id: string; unitId: string; unitName: string; kind: LogKind; values: Record<string, string>; flagged: boolean;
  note: string; byId: string; byName: string; at: Timestamp;
}
export type Priority = 'routine' | 'urgent';
export interface UnitRequest {
  id: string; unitId: string; unitName: string; title: string; details: string; priority: Priority;
  status: 'open' | 'in_progress' | 'done'; byId: string; byName: string; createdAt: Timestamp; resolvedAt?: Timestamp;
}
export interface UnitPost { id: string; unitId: string; text: string; byId: string; byName: string; at: Timestamp }

/** The recurring unit forms. Limits are starting defaults until Compliance DCS supplies the agency's forms. */
export const LOG_KINDS: Record<LogKind, { label: string; fields: { key: string; label: string; number?: boolean; max?: number }[] }> = {
  hot_water: { label: 'Hot water temperature', fields: [{ key: 'temp', label: 'Hot water temperature (°F)', number: true, max: 120 }] },
  fridge: { label: 'Refrigerator & freezer temperature', fields: [
    { key: 'fridge', label: 'Refrigerator (°F)', number: true, max: 40 },
    { key: 'freezer', label: 'Freezer (°F)', number: true, max: 0 },
  ] },
  emergency_box: { label: 'Emergency box check', fields: [] },
};
export const EMERGENCY_ITEMS = ['Flashlight & batteries', 'First-aid kit', 'Emergency contact list', 'Evacuation plan posted', 'Medication list'];

function useLive<T>(q: Query | null, key: string): T[] {
  const [rows, setRows] = useState<T[]>([]);
  useEffect(() => {
    if (!q) return;
    return onSnapshot(q, (s) => setRows(s.docs.map((d) => ({ ...d.data(), id: d.id }) as T)), () => {});
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return rows;
}
const ms = (t?: Timestamp | null) => t?.toMillis?.() ?? Date.now();

export const useUnits = () =>
  useLive<Unit>(query(collection(db, 'units')), 'u').filter((u) => u.active !== false).sort((a, b) => a.name.localeCompare(b.name));
export const useUnitLogs = (unitId: string) =>
  useLive<UnitLog>(query(collection(db, 'unitLogs'), where('unitId', '==', unitId)), unitId).sort((a, b) => ms(b.at) - ms(a.at));
export const useUnitRequests = (unitId?: string) =>
  useLive<UnitRequest>(unitId ? query(collection(db, 'unitRequests'), where('unitId', '==', unitId)) : query(collection(db, 'unitRequests'), where('status', '!=', 'done')), unitId ?? 'all')
    .sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
export const useUnitPosts = (unitId: string) =>
  useLive<UnitPost>(query(collection(db, 'unitPosts'), where('unitId', '==', unitId)), unitId).sort((a, b) => ms(b.at) - ms(a.at));

export async function addUnit(u: Omit<Unit, 'id' | 'active'>) { await addDoc(collection(db, 'units'), { ...u, active: true }); }
export const retireUnit = (id: string) => updateDoc(doc(db, 'units', id), { active: false });

export async function addLog(unit: Unit, kind: LogKind, values: Record<string, string>, note: string, me: UserProfile) {
  const flagged = LOG_KINDS[kind].fields.some((f) => f.max != null && values[f.key] !== '' && Number(values[f.key]) > f.max)
    || (kind === 'emergency_box' && Object.values(values).some((v) => v === 'no'));
  await addDoc(collection(db, 'unitLogs'), { unitId: unit.id, unitName: unit.name, kind, values, flagged, note: note.trim(), byId: me.uid, byName: me.name, at: serverTimestamp() });
}
export async function addRequest(unit: Unit, title: string, details: string, priority: Priority, me: UserProfile) {
  await addDoc(collection(db, 'unitRequests'), {
    unitId: unit.id, unitName: unit.name, title: title.trim(), details: details.trim(), priority, status: 'open',
    byId: me.uid, byName: me.name, createdAt: serverTimestamp(),
  });
}
export const setRequestStatus = (id: string, status: UnitRequest['status']) =>
  updateDoc(doc(db, 'unitRequests', id), { status, ...(status === 'done' ? { resolvedAt: serverTimestamp() } : {}) });
export const addPost = (unit: Unit, text: string, me: UserProfile) =>
  addDoc(collection(db, 'unitPosts'), { unitId: unit.id, text: text.trim(), byId: me.uid, byName: me.name, at: serverTimestamp() });
