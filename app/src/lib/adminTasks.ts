import { useEffect, useState } from 'react';
import { addDoc, arrayUnion, collection, doc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where, type Query } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { audit } from './audit';
import { db, storage } from './firebase';
import type { UserProfile } from './types';

export type TaskStatus = 'open' | 'submitted' | 'signed_off' | 'returned';
export interface Extension { reason: string; progress: string; newDeadline: number; status: 'pending' | 'approved' | 'denied'; requestedAt: number }
export interface HistoryItem { at: number; by: string; text: string }
export interface AdminTask {
  id: string; title: string; details: string; assignerId: string; assignerName: string; assigneeId: string; assigneeName: string;
  watcherIds: string[]; participants: string[]; deadline: number; status: TaskStatus; createdAt: Timestamp;
  attachments?: { name: string; path: string }[];
  response?: string; responseAt?: number; extension?: Extension; history?: HistoryItem[]; signedOffAt?: number;
}

/** Effective deadline: an approved extension moves it, without counting against anyone. */
export const dueOf = (t: AdminTask) => (t.extension?.status === 'approved' ? t.extension.newDeadline : t.deadline);
export const isOverdue = (t: AdminTask, now = Date.now()) => (t.status === 'open' || t.status === 'returned') && dueOf(t) < now;
export const wasLate = (t: AdminTask) => !!t.responseAt && t.responseAt > dueOf(t);

export const STATUS_TEXT: Record<TaskStatus, string> = { open: 'To do', submitted: 'Waiting for sign-off', signed_off: 'Signed off', returned: 'Sent back' };

export function useAdminTasks(me: UserProfile | null): AdminTask[] {
  const [rows, setRows] = useState<AdminTask[]>([]);
  useEffect(() => {
    if (!me) return;
    const c = collection(db, 'adminTasks');
    const q: Query = me.role === 'super_admin' ? query(c) : query(c, where('participants', 'array-contains', me.uid));
    return onSnapshot(q, (s) => setRows(s.docs.map((d) => ({ ...(d.data() as AdminTask), id: d.id }))), () => {});
  }, [me?.uid, me?.role]); // eslint-disable-line react-hooks/exhaustive-deps
  return rows.sort((a, b) => dueOf(a) - dueOf(b));
}

export async function createTask(me: UserProfile, d: { title: string; details: string; assignee: { id: string; name: string }; watchers: string[]; deadline: number }) {
  await addDoc(collection(db, 'adminTasks'), {
    title: d.title.trim(), details: d.details.trim(), assignerId: me.uid, assignerName: me.name, assigneeId: d.assignee.id, assigneeName: d.assignee.name,
    watcherIds: d.watchers, participants: [...new Set([me.uid, d.assignee.id, ...d.watchers])], deadline: d.deadline, status: 'open', createdAt: serverTimestamp(),
    history: [{ at: Date.now(), by: me.name, text: 'Task assigned' }],
  });
  audit(me, 'task', `Assigned "${d.title.trim()}" to ${d.assignee.name}`);
}

/** The response is locked once submitted: it cannot be edited afterwards, only sent back by the assigner. */
export interface Pick { name: string; type: string; blob: Blob }
export async function submitTask(t: AdminTask, me: UserProfile, response: string, files: Pick[] = []) {
  const attachments: { name: string; path: string }[] = [];
  for (const f of files) {
    const path = `taskFiles/${t.id}/${Date.now()}_${f.name.replace(/[^\w.\- ]/g, '_')}`;
    await uploadBytes(ref(storage, path), f.blob, { contentType: f.type });
    attachments.push({ name: f.name, path });
  }
  await updateDoc(doc(db, 'adminTasks', t.id), { status: 'submitted', response: response.trim(), responseAt: Date.now(), attachments, history: arrayUnion({ at: Date.now(), by: me.name, text: 'Submitted' }) });
}
export async function signOff(t: AdminTask, me: UserProfile, ok: boolean) {
  await updateDoc(doc(db, 'adminTasks', t.id), ok
    ? { status: 'signed_off', signedOffAt: Date.now(), history: arrayUnion({ at: Date.now(), by: me.name, text: 'Signed off' }) }
    : { status: 'returned', response: '', history: arrayUnion({ at: Date.now(), by: me.name, text: `Sent back (earlier response: ${(t.response ?? '').slice(0, 120)})` }) });
  audit(me, 'task', `${ok ? 'Signed off' : 'Sent back'} "${t.title}" (${t.assigneeName})`);
}
export const requestExtension = (t: AdminTask, me: UserProfile, reason: string, progress: string, newDeadline: number) =>
  updateDoc(doc(db, 'adminTasks', t.id), { extension: { reason: reason.trim(), progress: progress.trim(), newDeadline, status: 'pending', requestedAt: Date.now() }, history: arrayUnion({ at: Date.now(), by: me.name, text: 'Asked for more time' }) });
export async function decideExtension(t: AdminTask, me: UserProfile, ok: boolean) {
  await updateDoc(doc(db, 'adminTasks', t.id), { 'extension.status': ok ? 'approved' : 'denied', history: arrayUnion({ at: Date.now(), by: me.name, text: ok ? 'Extension approved' : 'Extension denied' }) });
  audit(me, 'task', `${ok ? 'Approved' : 'Denied'} an extension on "${t.title}" (${t.assigneeName})`);
}

export interface Score { id: string; name: string; assigned: number; onTime: number; late: number; overdue: number; extensions: number; score: number | null }
/** Monthly performance: tasks due up to the end of the month, plus anything still overdue that carried over. */
export function monthlyScores(tasks: AdminTask[], year: number, month: number, now = Date.now()): Score[] {
  const end = new Date(year, month + 1, 1).getTime();
  const start = new Date(year, month, 1).getTime();
  const by = new Map<string, Score>();
  for (const t of tasks) {
    const due = dueOf(t);
    const inMonth = due >= start && due < end;
    const carried = due < start && isOverdue(t, Math.min(now, end)); // still outstanding from earlier
    if (!inMonth && !carried) continue;
    const s = by.get(t.assigneeId) ?? { id: t.assigneeId, name: t.assigneeName, assigned: 0, onTime: 0, late: 0, overdue: 0, extensions: 0, score: null };
    s.assigned++;
    if (t.extension?.status === 'approved') s.extensions++;
    if (t.status === 'signed_off' || t.status === 'submitted') { if (wasLate(t)) s.late++; else s.onTime++; }
    else if (due < Math.min(now, end)) s.overdue++;
    by.set(t.assigneeId, s);
  }
  for (const s of by.values()) {
    const counted = s.onTime + s.late + s.overdue;
    s.score = counted === 0 ? null : Math.round(((s.onTime + 0.5 * s.late) / counted) * 100);
  }
  return [...by.values()].sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
}

export const attachmentUrl = (path: string) => getDownloadURL(ref(storage, path));
