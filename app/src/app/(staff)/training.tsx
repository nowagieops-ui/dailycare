import { Text } from 'react-native';
import { useAuth } from '../../lib/auth';
import { useCredentials, stageOf, stageTone } from '../../lib/credentials';
import { daysLeft, stageLabel } from '../../lib/expiry';
import { Card, fmtDay, Muted, Pill, s, Screen } from '../../lib/ui';

export default function Training() {
  const { profile } = useAuth();
  const rows = useCredentials(profile?.uid);
  return (
    <Screen title="Training & credentials">
      {rows.length === 0 && <Muted>Nothing on file yet.</Muted>}
      {rows.map((c) => {
        const days = daysLeft(c.expiresOn.toMillis());
        const st = stageOf(days);
        return (
          <Card key={c.id}>
            <Text style={s.h2}>{c.title}</Text>
            <Muted>Expires {fmtDay(c.expiresOn.toMillis())} · {days < 0 ? `${-days} days ago` : `${days} days left`}</Muted>
            <Pill text={stageLabel[st]} tone={stageTone(st)} />
          </Card>
        );
      })}
    </Screen>
  );
}
