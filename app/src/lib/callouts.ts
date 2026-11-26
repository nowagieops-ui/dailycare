import { useEffect, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where, getDocs, type Query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { audit } from './audit';
import { db, functions } from './firebase';
import type { Shift, UserProfile } from './types';

export const CALLOUT_NOTICE_HOURS = 48;
export const LEAVE_NOTICE_DAYS = 14;
export const MAX_COVER_HOURS = 16; // hours in any 24 hour span before a replacement is flagged for too many consecutive hours

export type CalloutStatus = 'requested' | 'approved' | 'denied' | 'accepted' | 'declined';
export interface Callout {
  id: string; kind: 'callout' | 'leave'; staffId: string; staffName: string; reason: string; emergency: boolean; shortNotice: boolean;
  noticeHours: number; status: CalloutStatus; createdAt: Timestamp;
  shiftId?: string; shiftStart?: Timestamp; shiftEnd?: Timestamp; clientName?: string;
  startDate?: string; endDate?: string;
  replacementId?: string; replacementName?: string;
  override?: boolean; decidedByName?: string; decisionNote?: string; respondedAt?: Timestamp;
}
export const STATUS_TEXT: Record<CalloutStatus, string> = {
  requested: 'Waiting for approval', approved: 'Approved', denied: 'Not approved', accepted: 'Covered', declined: 'Cover declined',
};
export const STATUS_TONE: Record<CalloutStatus, 'amber' | 'blue' | 'green' | 'red'> = {
  requested: 'amber', approved: 'blue', denied: 'red', accepted: 'green', declined: 'amber',
};

export function useCallouts(q: () => Query | null, key: string) {
  const [rows, setRows] = useState<Callout[]>([]);
  useEffect(() => {
    const x = q();
    if (!x) return;
    return onSnapshot(x, (s) => setRows(s.docs.map((d) => ({ ...(d.data() as Callout), id: d.id })).sort((a, b) => (b.createdAt?.toMillis?.() ?? Date.now()) - (a.createdAt?.toMillis?.() ?? Date.now()))), () => {});
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return rows;
}
export const useMyCallouts = (uid?: string) => useCallouts(() => (uid ? query(collection(db, 'callouts'), where('staffId', '==', uid)) : null), `m${uid}`);
export const useCoverRequests = (uid?: string) => useCallouts(() => (uid ? query(collection(db, 'callouts'), where('replacementId', '==', uid)) : null), `r${uid}`);
export const useAllCallouts = (enabled: boolean) => useCallouts(() => (enabled ? query(collection(db, 'callouts')) : null), `a${enabled}`);

export const hoursUntil = (ms: number) => (ms - Date.now()) / 3600000;

export async function requestCallout(me: UserProfile, shift: Shift, reason: string, emergency: boolean, replacement?: { id: string; name: string }) {
  const h = Math.round(hoursUntil(shift.start.toMillis()));
  await addDoc(collection(db, 'callouts'), {
    kind: 'callout', staffId: me.uid, staffName: me.name, shiftId: shift.id, shiftStart: shift.start, shiftEnd: shift.end, clientName: shift.clientName,
    reason: reason.trim(), emergency, noticeHours: h, shortNotice: h < CALLOUT_NOTICE_HOURS,
    ...(replacement ? { replacementId: replacement.id, replacementName: replacement.name } : {}),
    status: 'requested', createdAt: serverTimestamp(),
  });
}
export async function requestLeave(me: UserProfile, startDate: string, endDate: string, reason: string) {
  const days = (new Date(startDate + 'T00:00:00').getTime() - Date.now()) / 86400000;
  await addDoc(collection(db, 'callouts'), {
    kind: 'leave', staffId: me.uid, staffName: me.name, startDate, endDate, reason: reason.trim(), emergency: false,
    noticeHours: Math.round(days * 24), shortNotice: days < LEAVE_NOTICE_DAYS, status: 'requested', createdAt: serverTimestamp(),
  });
}
export const respondToCover = (id: string, accept: boolean) => httpsCallable(functions, 'respondCallout')({ id, accept });

/** Admin decision. Approving a short-notice request is recorded as a management override (kept for evaluations). */
export async function decideCallout(c: Callout, approve: boolean, note: string, me: UserProfile) {
  const ref = doc(db, 'callouts', c.id);
  if (!approve) {
    await updateDoc(ref, { status: 'denied', decidedByName: me.name, decisionNote: note.trim() });
    audit(me, 'callout', `Denied ${c.kind === 'leave' ? 'time off' : 'call-out'} for ${c.staffName}`);
    return;
  }
  await updateDoc(ref, { status: 'approved', decidedByName: me.name, decisionNote: note.trim(), ...(c.shortNotice ? { override: true } : {}) });
  if (c.kind === 'callout' && c.shiftId && !c.replacementId) {
    await updateDoc(doc(db, 'shifts', c.shiftId), { staffId: '', staffName: '' }); // no cover named: the shift opens up
  }
  if (c.kind === 'leave' && c.startDate && c.endDate) {
    const from = Timestamp.fromDate(new Date(c.startDate + 'T00:00:00'));
    const to = Timestamp.fromDate(new Date(c.endDate + 'T23:59:59'));
    const snap = await getDocs(query(collection(db, 'shifts'), where('staffId', '==', c.staffId)));
    for (const d of snap.docs) {
      const x = d.data();
      if (x.status === 'scheduled' && x.start.toMillis() >= from.toMillis() && x.start.toMillis() <= to.toMillis()) await updateDoc(d.ref, { staffId: '', staffName: '' });
    }
  }
  audit(me, 'callout', `Approved ${c.kind === 'leave' ? 'time off' : 'call-out'} for ${c.staffName}${c.shortNotice ? ' (short-notice override)' : ''}`);
}

/** Hours already scheduled for a replacement in the 24 hours around a shift, plus the shift itself. */
export function coverHours(shifts: Shift[], replacementId: string, start: number, end: number): number {
  const day = 24 * 3600000;
  const theirs = shifts.filter((x) => x.staffId === replacementId && x.end.toMillis() > start - day && x.start.toMillis() < end + day);
  const total = theirs.reduce((a, x) => a + (x.end.toMillis() - x.start.toMillis()), 0) + (end - start);
  return Math.round((total / 3600000) * 10) / 10;
}
