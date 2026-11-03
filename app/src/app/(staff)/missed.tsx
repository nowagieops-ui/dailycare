import { useState } from 'react';
import { Text } from 'react-native';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { DateField, TimeField } from '../../components/DateTimeFields';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/firebase';
import { atTime } from '../../lib/recurrence';
import { useMyShifts } from '../../lib/shifts';
import { useMissedRequests } from '../../lib/credentials';
import { Btn, Card, Chips, Field, fmtDay, Muted, Pill, s, Screen } from '../../lib/ui';

export default function Missed() {
  const { profile } = useAuth();
  const { shifts } = useMyShifts(profile?.uid, 24 * 7);
  const mine = useMissedRequests({ staffId: profile?.uid });
  const open = shifts.filter((x) => x.status !== 'completed' && x.start.toMillis() < Date.now());
  const [pick, setPick] = useState<string[]>([]);
  const [inT, setInT] = useState('');
  const [outT, setOutT] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const shift = open.find((x) => x.id === pick[0]);

  const day = shift ? new Date(shift.start.toMillis()) : null;
  const cin = day ? atTime(day, inT) : null;
  let cout = day ? atTime(day, outT) : null;
  if (cin && cout && cout <= cin) cout = new Date(cout.getTime() + 86400000); // overnight
  const ok = shift && cin && cout && reason.trim().length >= 10;

  async function submit() {
    if (!shift || !cin || !cout || !profile) return;
    await addDoc(collection(db, 'missedClockIns'), {
      staffId: profile.uid, staffName: profile.name, shiftId: shift.id, clientName: shift.clientName,
      reason: reason.trim(), clockIn: Timestamp.fromDate(cin), clockOut: Timestamp.fromDate(cout),
      status: 'pending', createdAt: Timestamp.now(),
    });
    setMsg('Sent to your supervisor for approval.');
    setPick([]); setInT(''); setOutT(''); setReason('');
  }

  return (
    <Screen title="Report missed clock-in">
      <Card>
        <Text style={s.h2}>Which shift?</Text>
        {open.length === 0 && <Muted>No unfinished shifts from the last 7 days.</Muted>}
        <Chips options={open.map((x) => ({ value: x.id, label: `${fmtDay(x.start.toMillis())} · ${x.clientName}` }))} selected={pick} onToggle={(v) => setPick([v])} />
        <TimeField label="Time you actually started" value={inT} onChange={setInT} />
        <TimeField label="Time you actually finished" value={outT} onChange={setOutT} />
        <Field label="Why was the clock-in missed? (min 10 characters)" value={reason} onChangeText={setReason} multiline
          style={[s.input, { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }]} />
        <Btn label="Submit for approval" onPress={submit} disabled={!ok} />
        {msg ? <Muted>{msg}</Muted> : null}
      </Card>
      {mine.map((r) => (
        <Card key={r.id}>
          <Text style={{ fontWeight: '700' }}>{r.clientName}</Text>
          <Pill text={r.status} tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'} />
        </Card>
      ))}
    </Screen>
  );
}
