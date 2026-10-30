import { Text } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { useOpenAlerts } from '../../lib/admin-data';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/firebase';
import { Btn, Card, fmtTime, Muted, Pill, s, Screen } from '../../lib/ui';

export default function Alerts() {
  const alerts = useOpenAlerts();
  const { signOutUser } = useAuth();
  return (
    <Screen title="Alerts">
      {alerts.length === 0 && <Muted>No open alerts. Everyone is where they should be.</Muted>}
      {alerts.map((a) => (
        <Card key={a.id}>
          <Pill text="Left the client's location" tone="red" />
          <Text style={s.h2}>{a.staffName || 'Staff member'}</Text>
          <Muted>left {a.clientName} at {fmtTime(a.at.toMillis())}</Muted>
          <Btn label="Mark resolved" tone="ghost" onPress={() => updateDoc(doc(db, 'alerts', a.id), { resolved: true })} />
        </Card>
      ))}
      <Btn label="Log out" tone="ghost" onPress={signOutUser} />
    </Screen>
  );
}
