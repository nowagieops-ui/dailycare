import { Text } from 'react-native';
import { useAuth } from '../../lib/auth';
import { useMyShifts } from '../../lib/shifts';
import { Card, fmtDay, fmtTime, Muted, Pill, s, Screen } from '../../lib/ui';

export default function Schedule() {
  const { profile } = useAuth();
  const { shifts, loading } = useMyShifts(profile?.uid);
  return (
    <Screen title="Schedule">
      {!loading && shifts.length === 0 && <Muted>No shifts scheduled.</Muted>}
      {shifts.map((sh) => (
        <Card key={sh.id}>
          <Text style={s.h2}>{fmtDay(sh.start.toMillis())}</Text>
          <Text style={{ fontWeight: '700' }}>{sh.clientName}</Text>
          <Muted>{fmtTime(sh.start.toMillis())} – {fmtTime(sh.end.toMillis())}</Muted>
          <Muted>{sh.address}</Muted>
          <Pill
            text={sh.status === 'completed' ? 'Completed' : sh.status === 'clocked_in' ? 'In progress' : sh.serviceLine}
            tone={sh.status === 'completed' ? 'green' : 'blue'}
          />
        </Card>
      ))}
    </Screen>
  );
}
