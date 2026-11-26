import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile } from './types';

export type AuditCategory = 'file' | 'dsp' | 'client' | 'unit' | 'task' | 'callout' | 'supply' | 'other';
export const AUDIT_LABELS: Record<AuditCategory, string> = {
  file: 'File manager', dsp: 'DSP', client: 'Client', unit: 'Residential units', task: 'Tasks', callout: 'Call-outs & leave', supply: 'Supplies', other: 'Other',
};

/** Records who did what (super admins read it). Never blocks the action it describes. */
export function audit(who: Pick<UserProfile, 'uid' | 'name' | 'email'> | null | undefined, category: AuditCategory, text: string) {
  if (!who) return;
  addDoc(collection(db, 'activity'), {
    at: serverTimestamp(), category, text, actorId: who.uid, actorName: who.name, actorEmail: who.email,
  }).catch(() => {});
}
