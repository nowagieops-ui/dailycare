import { useState } from 'react';
import { Text } from 'react-native';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { DateField, TimeField } from '../../components/DateTimeFields';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/firebase';
import { atTime, parseLocalDate } from '../../lib/recurrence';
import { useMyShifts } from '../../lib/shifts';
import { useMissedRequests } from '../../lib/credentials';
import { StaffScreen } from '../../lib/staff-ui';
import { Btn, Card, Chips, Field, fmtDay, fmtTime, Muted, Pill, s } from '../../lib/ui';

type Missed = 'in' | 'out' | 'both';
const MISSED: { value: Missed; label: string }[] = [
  { value: 'in', label: 'Missed Clock In' }, { value: 'out', label: 'Missed Clock Out' }, { value: 'both', label: 'Missed Clock In and Out' },
];
// Same reasons as the agency's current missed-clock form.
export const REASONS = [
  'Forgotten Clock In/Out', 'Staff Busy with Participant', 'Participant Phone Problems', 'ISAS Call Incomplete',
  'Staff in Community with Participant', 'OTP Issues', 'Correcting Staff Clock in/out Error', 'Emergency Situation', 'ISAS Call-in System Outage',
];
const label = (t: string, required = false) => (
  <Text style={{ fontWeight: '600', color: '#4A5A52', fontSize: 13 }}>{t}{required ? <Text style={{ color: '#C1554B' }}> *</Text> : null}</Text>
);

export default function Missed() {
  const { profile } = useAuth();
  const { shifts } = useMyShifts(profile?.uid, 24 * 14);
  const mine = useMissedRequests({ staffId: profile?.uid });
  const [fullName, setFullName] = useState(profile?.name ?? '');
  const [kind, setKind] = useState<Missed[]>(['in']);
  const [date, setDate] = useState('');
  const [pick, setPick] = useState<string[]>([]);
  const [inT, setInT] = useState('');
  const [outT, setOutT] = useState('');
  const [reason, setReason] = useState<string[]>([]);
  const [details, setDetails] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const day = parseLocalDate(date);
  const sameDay = (ms: number) => !!day && new Date(ms).toDateString() === day.toDateString();
  const dayShifts = shifts.filter((x) => sameDay(x.start.toMillis()));
  const shift = dayShifts.find((x) => x.id === pick[0]) ?? (dayShifts.length === 1 ? dayShifts[0] : undefined);
  const k = kind[0];
  const needIn = k === 'in' || k === 'both';
  const needOut = k === 'out' || k === 'both';
  const cin = day && needIn ? atTime(day, inT) : null;
  let cout = day && needOut ? atTime(day, outT) : null;
  if (cin && cout && cout <= cin) cout = new Date(cout.getTime() + 86400000); // overnight shift
  const ok = fullName.trim() && k && shift && (!needIn || cin) && (!needOut || cout) && reason[0];

  async function submit() {
    if (!ok || !shift || !profile) return;
    setBusy(true);
    try {
      await addDoc(collection(db, 'missedClockIns'), {
        staffId: profile.uid, staffName: profile.name, fullName: fullName.trim(), missed: k, shiftId: shift.id, clientName: shift.clientName,
        reason: details.trim() ? `${reason[0]}: ${details.trim()}` : reason[0],
        ...(cin ? { clockIn: Timestamp.fromDate(cin) } : {}), ...(cout ? { clockOut: Timestamp.fromDate(cout) } : {}),
        status: 'pending', createdAt: Timestamp.now(),
      });
      setMsg('Sent to your supervisor for approval.');
      setDate(''); setPick([]); setInT(''); setOutT(''); setReason([]); setDetails('');
    } catch { setMsg('Could not send. Check your connection and try again.'); }
    finally { setBusy(false); }
  }

  return (
    <StaffScreen title="Report missed clock-in">
      <Card>
        <Text style={{ color: '#4F6B1F', fontWeight: '800', fontSize: 16 }}>Please fill out the provided form below.</Text>
        <Field label="Full Name *" value={fullName} onChangeText={setFullName} />
        {label('Missed Clock', true)}
        <Chips<Missed> options={MISSED} selected={kind} onToggle={(v) => setKind([v])} />
        <DateField label="Date *" value={date} onChange={(v) => { setDate(v); setPick([]); }} />
        {date && dayShifts.length === 0 && <Muted>You have no shift on that date.</Muted>}
        {dayShifts.length > 1 && (
          <>
            {label('Which shift?', true)}
            <Chips options={dayShifts.map((x) => ({ value: x.id, label: `${fmtTime(x.start.toMillis())} · ${x.clientName}` }))} selected={pick} onToggle={(v) => setPick([v])} />
          </>
        )}
        {shift && dayShifts.length === 1 && <Muted>Shift: {fmtTime(shift.start.toMillis())}–{fmtTime(shift.end.toMillis())} · {shift.clientName}</Muted>}
        {needIn && <TimeField label="Time In" value={inT} onChange={setInT} />}
        {needOut && <TimeField label="Time Out" value={outT} onChange={setOutT} />}
        {label('Reason for Missed Clock', true)}
        <Chips options={REASONS.map((r) => ({ value: r, label: r }))} selected={reason} onToggle={(v) => setReason([v])} />
        <Field label="Additional details (optional)" value={details} onChangeText={setDetails} multiline
          style={[s.input, { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }]} />
        <Muted>Submit this as soon as possible so your supervisor can approve it in time for payroll.</Muted>
        <Btn label="Submit" onPress={submit} disabled={!ok} busy={busy} />
        {msg ? <Muted>{msg}</Muted> : null}
      </Card>
      {mine.length > 0 && <Text style={s.h2}>Your requests</Text>}
      {mine.map((r) => (
        <Card key={r.id}>
          <Text style={{ fontWeight: '700' }}>{r.clientName}</Text>
          <Muted>{r.missed === 'out' ? 'Missed clock out' : r.missed === 'both' ? 'Missed clock in and out' : 'Missed clock in'} · {fmtDay((r.clockIn ?? r.clockOut ?? r.createdAt).toMillis())}</Muted>
          <Pill text={r.status} tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'} />
        </Card>
      ))}
    </StaffScreen>
  );
}
