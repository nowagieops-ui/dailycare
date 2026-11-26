import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { usePeople } from '../lib/chat';
import { colors } from '../lib/theme';
import {
  decideSupply, saveSupplyFlow, STAGE_LABEL, STAGE_TONE, submitSupply, useSupplyFlow, useSupplyRequests, type SupplyFlow, type SupplyRequest,
} from '../lib/supply';
import type { Unit } from '../lib/units';
import { Btn, Card, Chips, Field, fmtDay, fmtTime, Muted, s, Tag } from '../lib/ui';

const stamp = (t?: { toMillis: () => number } | null) => (t ? `${fmtDay(t.toMillis())} ${fmtTime(t.toMillis())}` : 'just now');

/** The next action this person can take on a request, if any. */
function myAction(r: SupplyRequest, uid: string, f: SupplyFlow, isSuper: boolean): 'review' | 'approve' | 'arrange' | null {
  if (r.stage === 'review' && (f.reviewerIds.includes(uid) || isSuper)) return 'review';
  if (r.stage === 'approval' && (f.approverIds.includes(uid) || isSuper)) return 'approve';
  if (r.stage === 'purchasing' && (f.purchaserIds.includes(uid) || isSuper)) return 'arrange';
  return null;
}

function RequestCard({ r, flow }: { r: SupplyRequest; flow: SupplyFlow }) {
  const { profile } = useAuth();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const act = myAction(r, profile.uid, flow, profile.role === 'super_admin');
  const run = async (approve: boolean) => { setBusy(true); try { await decideSupply(r, approve, note, profile); setNote(''); } finally { setBusy(false); } };
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Text style={{ fontWeight: '700', color: colors.ink, flex: 1, minWidth: 160 }}>{r.items}</Text>
        {r.urgent && <Tag text="Urgent" tone="red" />}
        <Tag text={STAGE_LABEL[r.stage]} tone={STAGE_TONE[r.stage]} />
      </View>
      <Muted>{r.unitName} · {r.kind === 'unit' ? 'For the unit' : `For ${r.forName || 'an individual'}`} · {r.byName} · {stamp(r.createdAt)}</Muted>
      {r.details ? <Text style={{ color: colors.ink }}>{r.details}</Text> : null}
      {r.reviewedByName ? <Muted>Reviewed by {r.reviewedByName}{r.reviewNote ? `: ${r.reviewNote}` : ''}</Muted> : null}
      {r.approvedByName ? <Muted>Approved by {r.approvedByName}{r.approvalNote ? `: ${r.approvalNote}` : ''}</Muted> : null}
      {r.stage === 'rejected' ? <Muted>Declined by {r.rejectedByName} at the {r.rejectedAtStage === 'review' ? 'review' : 'approval'} step{r.rejectNote ? `: ${r.rejectNote}` : ''}</Muted> : null}
      {r.fulfilledByName ? <Muted>Arranged by {r.fulfilledByName}</Muted> : null}
      {act && (
        <>
          {act !== 'arrange' && <Field label="Note (optional)" value={note} onChangeText={setNote} />}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {act !== 'arrange' && <View style={{ flex: 1 }}><Btn label="Decline" tone="danger" busy={busy} onPress={() => run(false)} /></View>}
            <View style={{ flex: 1 }}><Btn label={act === 'review' ? 'Send for approval' : act === 'approve' ? 'Approve' : 'Mark as arranged'} busy={busy} onPress={() => run(true)} /></View>
          </View>
        </>
      )}
    </Card>
  );
}

/** Supplies tab inside one unit: request form and that unit's requests. */
export function UnitSupplies({ unit }: { unit: Unit }) {
  const { profile } = useAuth();
  const flow = useSupplyFlow();
  const rows = useSupplyRequests(profile, flow, unit.id);
  const [kind, setKind] = useState<string[]>(['unit']);
  const [forName, setForName] = useState('');
  const [items, setItems] = useState('');
  const [details, setDetails] = useState('');
  const [urgent, setUrgent] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const noFlow = flow.reviewerIds.length === 0;
  return (
    <>
      <Card>
        <Text style={s.h2}>Request supplies</Text>
        {noFlow && <Muted>Approvals have not been set up yet, so requests will wait until a super admin chooses who reviews them.</Muted>}
        <Chips options={[{ value: 'unit', label: 'Needed by the unit' }, { value: 'individual', label: 'Needed by an individual' }]} selected={kind} onToggle={(v) => setKind([v])} />
        {kind[0] === 'individual' && <Field label="Which individual?" value={forName} onChangeText={setForName} />}
        <Field label="What do you need?" value={items} onChangeText={setItems} />
        <Field label="Details (size, quantity, reason)" value={details} onChangeText={setDetails} multiline />
        <Chips options={[{ value: 'urgent', label: 'Urgent' }]} selected={urgent} onToggle={() => setUrgent((u) => (u.length ? [] : ['urgent']))} />
        <Btn label="Send request" busy={busy} disabled={!items.trim() || (kind[0] === 'individual' && !forName.trim())}
          onPress={async () => {
            setBusy(true);
            try { await submitSupply(unit, { kind: kind[0] as 'unit' | 'individual', forName, items, details, urgent: urgent.length > 0 }, profile); setItems(''); setDetails(''); setForName(''); setUrgent([]); }
            finally { setBusy(false); }
          }} />
      </Card>
      {rows.length === 0 && <Muted>No supply requests for this unit.</Muted>}
      {rows.map((r) => <RequestCard key={r.id} r={r} flow={flow} />)}
    </>
  );
}

/** Everything waiting on the signed-in person, across all units (shown at the top of the units list). */
export function SupplyQueue() {
  const { profile } = useAuth();
  const flow = useSupplyFlow();
  const rows = useSupplyRequests(profile, flow);
  if (!profile) return null;
  const mine = rows.filter((r) => myAction(r, profile.uid, flow, profile.role === 'super_admin') !== null);
  if (mine.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.h2}>Supply requests waiting for you ({mine.length})</Text>
      {mine.map((r) => <RequestCard key={r.id} r={r} flow={flow} />)}
    </View>
  );
}

/** Super admin: choose who reviews, approves and arranges supply requests. */
export function SupplyFlowSetup() {
  const { profile } = useAuth();
  const flow = useSupplyFlow();
  const people = usePeople();
  const [msg, setMsg] = useState('');
  if (profile?.role !== 'super_admin') return null;
  const toggle = (k: keyof SupplyFlow) => async (id: string) => {
    const cur = flow[k];
    await saveSupplyFlow({ ...flow, [k]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
    setMsg('Saved.');
  };
  const opts = people.map((p) => ({ value: p.id, label: p.name }));
  return (
    <Card>
      <Text style={s.h2}>Supply request approvals</Text>
      <Muted>A request goes to the reviewer first. If they approve it, it goes to the approvers, and any one of them can approve. Only then do the purchasers hear about it. A "no" at either step ends the request.</Muted>
      <Text style={{ fontWeight: '600' }}>1. Reviewer(s): screen every request first</Text>
      <Chips options={opts} selected={flow.reviewerIds} onToggle={toggle('reviewerIds')} />
      <Text style={{ fontWeight: '600' }}>2. Approvers: any one of them can approve</Text>
      <Chips options={opts} selected={flow.approverIds} onToggle={toggle('approverIds')} />
      <Text style={{ fontWeight: '600' }}>3. Purchasers: notified only after approval</Text>
      <Chips options={opts} selected={flow.purchaserIds} onToggle={toggle('purchaserIds')} />
      {msg ? <Muted>{msg}</Muted> : null}
    </Card>
  );
}
