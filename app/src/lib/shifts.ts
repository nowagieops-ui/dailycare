import { useEffect, useState } from 'react';
import {
  collection, doc, onSnapshot, orderBy, query, Timestamp, updateDoc, where, limit,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Announcement, Shift, Task } from './types';

/** Staff member's shifts from 12h ago onward (so an in-progress overnight shift still shows). */
export function useMyShifts(uid: string | undefined, sinceHours = 12) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) return;
    const since = Timestamp.fromMillis(Date.now() - sinceHours * 3600 * 1000);
    const q = query(
      collection(db, 'shifts'),
      where('staffId', '==', uid),
      where('start', '>=', since),
      orderBy('start', 'asc'),
    );
    return onSnapshot(
      q,
      (snap) => {
        setShifts(snap.docs.map((d) => ({ ...(d.data() as Shift), id: d.id })));
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid, sinceHours]);
  return { shifts, loading };
}

export function useAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(10));
    return onSnapshot(q, (s) => setItems(s.docs.map((d) => ({ ...(d.data() as Announcement), id: d.id }))), () => {});
  }, []);
  return items;
}

/** The shift the staff member should be acting on now: one in progress, else the next one. */
export function pickCurrent(shifts: Shift[]): Shift | undefined {
  return shifts.find((s) => s.status === 'clocked_in') ?? shifts.find((s) => s.status === 'scheduled');
}

/** Checklist and clock-in unlock 15 minutes before the shift starts. */
export const EARLY_MS = 15 * 60 * 1000;
export const isShiftTime = (s: Shift, now = Date.now()) => now >= s.start.toMillis() - EARLY_MS;

export const clockIn = (s: Shift, lat: number, lng: number) =>
  updateDoc(doc(db, 'shifts', s.id), {
    status: 'clocked_in',
    clockInAt: Timestamp.now(),
    clockInLat: lat,
    clockInLng: lng,
  });

export const clockOut = (s: Shift) =>
  updateDoc(doc(db, 'shifts', s.id), { status: 'completed', clockOutAt: Timestamp.now() });

export const saveTasks = (shiftId: string, tasks: Task[]) =>
  updateDoc(doc(db, 'shifts', shiftId), { tasks });

export const saveNote = (shiftId: string, note: string) =>
  updateDoc(doc(db, 'shifts', shiftId), { note });

/** Why clock-out is blocked, or null if it is allowed. */
export function clockOutBlocker(s: Shift): string | null {
  const open = s.tasks.filter((t) => !t.done).length;
  if (open > 0) return `${open} task${open === 1 ? '' : 's'} still to complete`;
  if (s.note.trim().length < 10) return "Write today's daily note first";
  return null;
}
