import { useEffect, useState } from 'react';
import {
  addDoc, collection, doc, onSnapshot, setDoc, query, serverTimestamp, Timestamp, updateDoc, where, type Query,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Shift, UserProfile } from './types';

export interface Unit { id: string; name: string; type: 'home' | 'apartment'; address: string; notes: string; active: boolean; requiredLogs?: LogKind[]; nightChecks?: boolean }
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

export const setUnitRules = (id: string, d: { requiredLogs?: LogKind[]; nightChecks?: boolean }) => updateDoc(doc(db, 'units', id), d);

// ---- Hourly night checks ----
export const NIGHT_STATUSES = ['Sleeping', 'Awake and calm', 'Awake, needs support', 'Not in room', 'Other (see note)'];
const HOUR = 3600000;
const isNightHour = (ms: number) => { const h = new Date(ms).getHours(); return h >= 22 || h < 6; };
export const CHECK_OPENS_BEFORE = 15 * 60000;
export const CHECK_CLOSES_AFTER = 5 * 60000;

/** Top-of-the-hour check times between 10pm and 6am during a shift. */
export function nightSlots(s: Pick<Shift, 'start' | 'end'>): number[] {
  const out: number[] = [];
  const first = Math.ceil(s.start.toMillis() / HOUR) * HOUR;
  for (let t = first; t < s.end.toMillis(); t += HOUR) if (isNightHour(t)) out.push(t);
  return out;
}
export interface UnitCheck { id: string; unitId: string; shiftId: string; slot: Timestamp; status: string; note: string; byId: string; byName: string; at: Timestamp }
export const useShiftChecks = (shiftId?: string) =>
  useLive<UnitCheck>(shiftId ? query(collection(db, 'unitChecks'), where('shiftId', '==', shiftId)) : null, `c${shiftId}`);
export const useUnitChecks = (unitId?: string) =>
  useLive<UnitCheck>(unitId ? query(collection(db, 'unitChecks'), where('unitId', '==', unitId)) : null, `u${unitId}`);
export async function submitNightCheck(shift: Shift, slot: number, status: string, note: string, me: UserProfile) {
  await setDoc(doc(db, 'unitChecks', `${shift.id}_${slot}`), {
    unitId: shift.unitId, shiftId: shift.id, slot: Timestamp.fromMillis(slot), status, note: note.trim(), byId: me.uid, byName: me.name, at: serverTimestamp(),
  });
}
/** 'open' = can be filled in now, 'upcoming' = not yet, 'done', or 'missed' (closed 5 minutes after the hour, never backfilled). */
export function slotState(slot: number, done: boolean, now = Date.now()): 'done' | 'open' | 'upcoming' | 'missed' {
  if (done) return 'done';
  if (now > slot + CHECK_CLOSES_AFTER) return 'missed';
  return now >= slot - CHECK_OPENS_BEFORE ? 'open' : 'upcoming';
}
/** Why clock-out is blocked for a residential shift, or null. Missed (closed) checks are recorded, not blocking. */
export function residentialBlocker(shift: Shift, unit: Unit | undefined, logs: UnitLog[], checks: UnitCheck[], uid: string, now = Date.now()): string | null {
  if (!shift.unitId || !unit) return null;
  const since = shift.clockInAt?.toMillis() ?? shift.start.toMillis();
  const need = (unit.requiredLogs ?? []).filter((k) => !logs.some((l) => l.kind === k && l.byId === uid && (l.at?.toMillis?.() ?? now) >= since));
  if (need.length) return `Complete the ${need.map((k) => LOG_KINDS[k].label.toLowerCase()).join(' and ')} log for ${unit.name}`;
  if (unit.nightChecks) {
    const due = nightSlots(shift).find((t) => slotState(t, checks.some((c) => c.slot.toMillis() === t), now) === 'open');
    if (due !== undefined) return 'An hourly night check is due. Fill it in first';
  }
  return null;
}
