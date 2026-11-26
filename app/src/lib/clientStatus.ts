import { useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { audit } from './audit';
import type { EDoc } from './ebinder';
import type { Client, ClientStatus, Shift, UserProfile } from './types';

export const STATUS_LABEL: Record<ClientStatus, string> = {
  potential: 'Potential', pending: 'Pending', approved: 'Approved – not active', active: 'Active', inactive: 'Inactive', discharged: 'Discharged',
};
export const STATUS_FOLDER = STATUS_LABEL; // file-manager folder names under Individuals
export const STATUS_TONE: Record<ClientStatus, 'neutral' | 'amber' | 'blue' | 'green' | 'red'> = {
  potential: 'neutral', pending: 'amber', approved: 'blue', active: 'green', inactive: 'neutral', discharged: 'red',
};
export const ALL_STATUSES = Object.keys(STATUS_LABEL) as ClientStatus[];
/** Clients created before statuses existed are already being served. */
export const statusOf = (c: Pick<Client, 'status'>): ClientStatus => c.status ?? 'active';

/**
 * The next stage a client has earned from documented actions (never skips ahead, never moves backwards):
 *  potential -> pending : intake and service-planning information saved (contact, date of birth, goals)
 *  pending   -> approved: an approved plan (PCP) is filed under Care Plans in the client's eBinder
 *  approved  -> active  : services actually started (a service start date reached with a DSP scheduled, or a visit worked)
 */
export function earnedStatus(c: Client, docs: EDoc[], shifts: Shift[], now = Date.now()): ClientStatus | null {
  const st = statusOf(c);
  if (st === 'potential') return c.contactName && c.dob && (c.goals ?? []).length > 0 ? 'pending' : null;
  if (st === 'pending') return docs.some((d) => d.clientId === c.id && d.folder === 'Care Plans') ? 'approved' : null;
  if (st === 'approved') {
    const mine = shifts.filter((x) => x.clientId === c.id);
    const worked = mine.some((x) => x.status === 'clocked_in' || x.status === 'completed');
    const started = !!c.serviceStart && new Date(c.serviceStart + 'T00:00:00').getTime() <= now && mine.some((x) => !!x.staffId);
    return worked || started ? 'active' : null;
  }
  return null;
}

/** Runs while an admin has the clients list open: moves clients forward when their documented milestones are met. */
export function useAutoStatus(clients: Client[], docs: EDoc[], shifts: Shift[], me: UserProfile | null) {
  const done = useRef(new Set<string>());
  useEffect(() => {
    if (!me) return;
    for (const c of clients) {
      const next = earnedStatus(c, docs, shifts);
      const key = `${c.id}:${next}`;
      if (!next || done.current.has(key)) continue;
      done.current.add(key);
      updateDoc(doc(db, 'clients', c.id), { status: next })
        .then(() => audit(me, 'client', `${c.name} moved from ${STATUS_LABEL[statusOf(c)]} to ${STATUS_LABEL[next]} (automatic)`))
        .catch(() => {});
    }
  }, [clients, docs, shifts, me?.uid]); // eslint-disable-line react-hooks/exhaustive-deps
}
