import { useEffect, useState } from 'react';
import { addDoc, collection, onSnapshot, query, serverTimestamp, where, type Timestamp } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, storage } from './firebase';
import type { Shift } from './types';

export type FieldType = 'text' | 'multiline' | 'checkbox' | 'date' | 'select' | 'signature';
export type Prefill = 'staff_name' | 'client_name' | 'service_line' | 'visit_date' | 'today';
export type Target =
  | { kind: 'acro'; name: string }
  | { kind: 'box'; page: number; x: number; y: number; w: number; h: number; fontSize?: number };

export interface FormField {
  key: string; label: string; type: FieldType; required: boolean;
  options?: string[]; prefill?: Prefill; target: Target;
}
export interface FormTemplate {
  id: string; title: string; pdfPath: string; fields: FormField[];
  serviceLines: string[]; // empty + no clients = applies to every visit
  clientIds: string[];
  required: boolean; // must be completed before clock-out
  active: boolean;
  pages?: { width: number; height: number }[];
  createdAt?: Timestamp;
}
export type Answer = string | boolean | { typed: string; drawn?: string };
export interface FormSubmission {
  id: string; templateId: string; shiftId: string; clientId: string; staffId: string;
  values: Record<string, Answer>; status: 'pending' | 'ready' | 'failed'; error?: string; pdfPath?: string; createdAt: Timestamp;
}

export const PREFILL_LABEL: Record<Prefill, string> = {
  staff_name: 'Staff name', client_name: 'Client name', service_line: 'Service line', visit_date: 'Visit date', today: "Today's date",
};

export function useTemplates() {
  const [rows, setRows] = useState<FormTemplate[]>([]);
  useEffect(() => onSnapshot(collection(db, 'formTemplates'),
    (s) => setRows(s.docs.map((d) => ({ ...(d.data() as FormTemplate), id: d.id })).sort((a, b) => a.title.localeCompare(b.title))), () => {}), []);
  return rows;
}

/** Templates that apply to this visit: active, and either for everyone or matching its service line / client. */
export const formsForShift = (templates: FormTemplate[], s: Pick<Shift, 'serviceLine' | 'clientId'>) =>
  templates.filter((t) => t.active && (
    (t.serviceLines.length === 0 && t.clientIds.length === 0) ||
    t.serviceLines.includes(s.serviceLine) || t.clientIds.includes(s.clientId)));

export function useShiftSubmissions(shiftId: string | undefined, uid: string | undefined) {
  const [rows, setRows] = useState<FormSubmission[]>([]);
  useEffect(() => {
    if (!shiftId || !uid) return;
    // Both equality filters: rules only allow reading your own submissions.
    return onSnapshot(query(collection(db, 'formSubmissions'), where('shiftId', '==', shiftId), where('staffId', '==', uid)),
      (s) => setRows(s.docs.map((d) => ({ ...(d.data() as FormSubmission), id: d.id }))), () => {});
  }, [shiftId, uid]);
  return rows;
}

/** Newest usable submission for a template ('failed' ones do not count; the staff member can redo them). */
export const submissionFor = (subs: FormSubmission[], templateId: string) =>
  subs.filter((x) => x.templateId === templateId && x.status !== 'failed')
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))[0];

/** Why clock-out is blocked by forms, or null. A required form must at least be submitted. */
export function formsBlocker(templates: FormTemplate[], subs: FormSubmission[]): string | null {
  const missing = templates.filter((t) => t.required && !submissionFor(subs, t.id));
  if (!missing.length) return null;
  return `Complete the form${missing.length === 1 ? '' : 's'}: ${missing.map((t) => t.title).join(', ')}`;
}

export const submitForm = (t: FormTemplate, s: Shift, uid: string, values: Record<string, Answer>) =>
  addDoc(collection(db, 'formSubmissions'), {
    templateId: t.id, shiftId: s.id, clientId: s.clientId, staffId: uid, values, status: 'pending', createdAt: serverTimestamp(),
  });

export const pdfDownloadUrl = (path: string) => getDownloadURL(ref(storage, path));

/** Initial answers: today's date for date fields; prefilled fields are shown but the server sets the real value. */
export function initialValues(t: FormTemplate, ctx: { staffName: string; shift: Shift }): Record<string, Answer> {
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const pre: Record<Prefill, string> = {
    staff_name: ctx.staffName, client_name: ctx.shift.clientName, service_line: ctx.shift.serviceLine,
    visit_date: fmt(ctx.shift.start.toDate()), today: fmt(new Date()),
  };
  const out: Record<string, Answer> = {};
  for (const f of t.fields) {
    if (f.prefill) out[f.key] = pre[f.prefill];
    else if (f.type === 'checkbox') out[f.key] = false;
    else if (f.type === 'date') out[f.key] = fmt(new Date());
    else out[f.key] = f.type === 'signature' ? { typed: '' } : '';
  }
  return out;
}
