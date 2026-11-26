import { useEffect, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, type Query } from 'firebase/firestore';
import { audit } from './audit';
import { db } from './firebase';
import type { UserProfile } from './types';
import type { Unit } from './units';

export interface SupplyFlow { reviewerIds: string[]; approverIds: string[]; purchaserIds: string[] }
export type SupplyStage = 'review' | 'approval' | 'purchasing' | 'rejected' | 'fulfilled';
export interface SupplyRequest {
  id: string; unitId: string; unitName: string; kind: 'unit' | 'individual'; forName: string; items: string; details: string;
  urgent: boolean; stage: SupplyStage; byId: string; byName: string; createdAt: Timestamp;
  reviewedByName?: string; reviewNote?: string; approvedByName?: string; approvalNote?: string; rejectedAtStage?: string; rejectedByName?: string; rejectNote?: string;
  fulfilledByName?: string;
}

export const STAGE_LABEL: Record<SupplyStage, string> = {
  review: 'Waiting for review', approval: 'Waiting for approval', purchasing: 'Approved – being arranged', rejected: 'Declined', fulfilled: 'Done',
};
export const STAGE_TONE: Record<SupplyStage, 'amber' | 'blue' | 'green' | 'red'> = {
  review: 'amber', approval: 'amber', purchasing: 'blue', rejected: 'red', fulfilled: 'green',
};

const EMPTY: SupplyFlow = { reviewerIds: [], approverIds: [], purchaserIds: [] };
export function useSupplyFlow(): SupplyFlow {
  const [f, setF] = useState<SupplyFlow>(EMPTY);
  useEffect(() => onSnapshot(doc(db, 'settings', 'supplyFlow'), (x) => setF({ ...EMPTY, ...(x.data() as Partial<SupplyFlow>) }), () => {}), []);
  return f;
}
export const saveSupplyFlow = (f: SupplyFlow) => setDoc(doc(db, 'settings', 'supplyFlow'), f);

/** Everyone in the flow (and the office) can read all requests; anyone else only their own. */
export function useSupplyRequests(me: UserProfile | null, flow: SupplyFlow, unitId?: string): SupplyRequest[] {
  const [rows, setRows] = useState<SupplyRequest[]>([]);
  const inFlow = !!me && [...flow.reviewerIds, ...flow.approverIds, ...flow.purchaserIds].includes(me.uid);
  const wide = !!me && (inFlow || me.role === 'admin' || me.role === 'super_admin' || me.role === 'case_manager');
  useEffect(() => {
    if (!me) return;
    const c = collection(db, 'supplyRequests');
    const q: Query = wide ? query(c) : query(c, where('byId', '==', me.uid));
    return onSnapshot(q, (s) => setRows(s.docs.map((d) => ({ ...(d.data() as SupplyRequest), id: d.id }))), () => {});
  }, [me?.uid, wide]); // eslint-disable-line react-hooks/exhaustive-deps
  return rows
    .filter((r) => !unitId || r.unitId === unitId)
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? Date.now()) - (a.createdAt?.toMillis?.() ?? Date.now()));
}

export async function submitSupply(unit: Unit, d: { kind: 'unit' | 'individual'; forName: string; items: string; details: string; urgent: boolean }, me: UserProfile) {
  await addDoc(collection(db, 'supplyRequests'), {
    unitId: unit.id, unitName: unit.name, kind: d.kind, forName: d.kind === 'individual' ? d.forName.trim() : '', items: d.items.trim(), details: d.details.trim(),
    urgent: d.urgent, stage: 'review', byId: me.uid, byName: me.name, createdAt: serverTimestamp(),
  });
}

/** Moves a request along: reviewer -> approvers -> purchasers. A "no" at any step ends it. */
export async function decideSupply(r: SupplyRequest, approve: boolean, note: string, me: UserProfile) {
  const ref = doc(db, 'supplyRequests', r.id);
  const n = note.trim();
  if (!approve) {
    await updateDoc(ref, { stage: 'rejected', rejectedAtStage: r.stage, rejectedByName: me.name, rejectNote: n });
    audit(me, 'supply', `Declined supply request for ${r.unitName} (${r.items.slice(0, 60)})`);
    return;
  }
  if (r.stage === 'review') await updateDoc(ref, { stage: 'approval', reviewedByName: me.name, reviewNote: n });
  else if (r.stage === 'approval') await updateDoc(ref, { stage: 'purchasing', approvedByName: me.name, approvalNote: n });
  else if (r.stage === 'purchasing') await updateDoc(ref, { stage: 'fulfilled', fulfilledByName: me.name });
  audit(me, 'supply', `${r.stage === 'purchasing' ? 'Completed' : 'Approved'} supply request for ${r.unitName} (${r.items.slice(0, 60)})`);
}
