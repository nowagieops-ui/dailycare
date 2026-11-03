import { useEffect, useState } from 'react';
import {
  collection, doc, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch, type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile } from './types';

export const FOLDERS = ['Care Plans', 'HR & Personnel', 'Waiver & Medicaid', 'Policies'] as const;
export type Folder = (typeof FOLDERS)[number];
export type Audience = 'all_staff' | 'assigned' | 'admin';

export interface EDoc {
  id: string;
  title: string;
  folder: Folder;
  version: number;
  audience: Audience;
  assignedTo: string[]; // staff uids, used when audience is 'assigned'
  requiresSignature: boolean;
  body: string; // may contain {{name}} and {{date}}
  acks: string[]; // lines the signer must tick
  uploadedByName: string;
  updatedAt: Timestamp;
}
export interface Signature {
  id: string; staffId: string; staffName: string; version: number; typedName: string; signedAt: Timestamp; acks: string[]; bodyText: string;
}
export interface DocEvent { id: string; at: Timestamp; actorId: string; actorName: string; text: string }

export const audienceLabel: Record<Audience, string> = { all_staff: 'Staff visible', assigned: 'Assigned staff', admin: 'Admin only' };

export const renderBody = (body: string, name: string, date: string) =>
  body.replace(/\{\{name\}\}/g, name || '________').replace(/\{\{date\}\}/g, date);

const snap = <T,>(s: { docs: { id: string; data: () => unknown }[] }) => s.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T);

export function useAdminDocs() {
  const [rows, setRows] = useState<EDoc[]>([]);
  useEffect(() => onSnapshot(query(collection(db, 'ebinderDocs'), orderBy('updatedAt', 'desc')), (s) => setRows(snap<EDoc>(s)), () => {}), []);
  return rows;
}

/** Documents a staff member may see: shared with everyone, or assigned to them. */
export function useStaffDocs(uid: string | undefined) {
  const [all, setAll] = useState<EDoc[]>([]);
  const [mine, setMine] = useState<EDoc[]>([]);
  useEffect(() => {
    if (!uid) return;
    const a = onSnapshot(query(collection(db, 'ebinderDocs'), where('audience', '==', 'all_staff')), (s) => setAll(snap<EDoc>(s)), () => {});
    const b = onSnapshot(query(collection(db, 'ebinderDocs'), where('audience', '==', 'assigned'), where('assignedTo', 'array-contains', uid)), (s) => setMine(snap<EDoc>(s)), () => {});
    return () => { a(); b(); };
  }, [uid]);
  return [...all, ...mine].sort((x, y) => y.updatedAt?.toMillis() - x.updatedAt?.toMillis());
}

export function useSignatures(docId: string | undefined) {
  const [rows, setRows] = useState<Signature[]>([]);
  useEffect(() => {
    if (!docId) return;
    return onSnapshot(collection(db, 'ebinderDocs', docId, 'signatures'), (s) => setRows(snap<Signature>(s)), () => {});
  }, [docId]);
  return rows;
}

export function useDocEvents(docId: string | undefined) {
  const [rows, setRows] = useState<DocEvent[]>([]);
  useEffect(() => {
    if (!docId) return;
    return onSnapshot(query(collection(db, 'ebinderDocs', docId, 'events'), orderBy('at', 'asc')), (s) => setRows(snap<DocEvent>(s)), () => {});
  }, [docId]);
  return rows;
}

/** Which of these documents has this staff member signed (at the current version)? */
export function useSignedIds(docs: EDoc[], uid: string | undefined) {
  const [signed, setSigned] = useState<Record<string, boolean>>({});
  const key = docs.map((d) => `${d.id}:${d.version}`).join(',');
  useEffect(() => {
    if (!uid) return;
    const offs = docs.filter((d) => d.requiresSignature).map((d) =>
      onSnapshot(doc(db, 'ebinderDocs', d.id, 'signatures', `${uid}_v${d.version}`),
        (s) => setSigned((c) => ({ ...c, [d.id]: s.exists() })), () => {}));
    return () => offs.forEach((o) => o());
  }, [key, uid]); // eslint-disable-line react-hooks/exhaustive-deps
  return signed;
}

export const logEvent = (docId: string, actor: UserProfile, text: string) =>
  writeBatch(db).set(doc(collection(db, 'ebinderDocs', docId, 'events')), { at: serverTimestamp(), actorId: actor.uid, actorName: actor.name, text }).commit();

export async function signDocument(d: EDoc, who: UserProfile, typedName: string, dateText: string) {
  const b = writeBatch(db);
  b.set(doc(db, 'ebinderDocs', d.id, 'signatures', `${who.uid}_v${d.version}`), {
    staffId: who.uid, staffName: who.name, version: d.version, typedName, acks: d.acks,
    bodyText: renderBody(d.body, typedName, dateText), signedAt: serverTimestamp(),
  });
  b.set(doc(collection(db, 'ebinderDocs', d.id, 'events')), { at: serverTimestamp(), actorId: who.uid, actorName: who.name, text: `${who.name} signed document (v${d.version})` });
  await b.commit();
}
