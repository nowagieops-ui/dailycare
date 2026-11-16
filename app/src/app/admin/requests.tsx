import { Text } from 'react-native';
import { doc, writeBatch } from 'firebase/firestore';
import { useMissedRequests } from '../../lib/credentials';
import { db } from '../../lib/firebase';
import type { MissedClockIn } from '../../lib/types';
import { Btn, Card, fmtDay, fmtTime, Muted, s, Screen } from '../../lib/ui';

export default function Requests() {
  const rows = useMissedRequests({ pendingOnly: true });

  async function decide(r: MissedClockIn, approve: boolean) {
    const b = writeBatch(db);
    b.update(doc(db, 'missedClockIns', r.id), { status: approve ? 'approved' : 'rejected' });
    // Approval records the corrected punch times on the shift itself.
    if (approve) {
      b.update(doc(db, 'shifts', r.shiftId), {
        ...(r.clockIn ? { clockInAt: r.clockIn } : {}), ...(r.clockOut ? { clockOutAt: r.clockOut, status: 'completed' } : { status: 'clocked_in' }),
      });
    }
    await b.commit();
  }

  return (
    <Screen title="Missed clock-in requests">
      {rows.length === 0 && <Muted>No pending requests.</Muted>}
      {rows.map((r) => (
        <Card key={r.id}>
          <Text style={s.h2}>{r.staffName} · {r.clientName}</Text>
          <Muted>
            {r.missed === 'out' ? 'Missed clock out' : r.missed === 'both' ? 'Missed clock in and out' : 'Missed clock in'} · {fmtDay((r.clockIn ?? r.clockOut)!.toMillis())}
            {r.clockIn ? ` · In ${fmtTime(r.clockIn.toMillis())}` : ''}{r.clockOut ? ` · Out ${fmtTime(r.clockOut.toMillis())}` : ''}
          </Muted>
          {r.fullName && r.fullName !== r.staffName ? <Muted>Name on form: {r.fullName}</Muted> : null}
          <Text>{r.reason}</Text>
          <Btn label="Approve and fix times" onPress={() => decide(r, true)} />
          <Btn label="Reject" tone="danger" onPress={() => decide(r, false)} />
        </Card>
      ))}
    </Screen>
  );
}
