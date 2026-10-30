import { Link } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '../../lib/auth';
import { pickCurrent, useAnnouncements, useMyShifts } from '../../lib/shifts';
import { Btn, Card, fmtDay, fmtTime, Muted, Pill, s, Screen } from '../../lib/ui';

export default function Home() {
  const { profile, signOutUser } = useAuth();
  const { shifts } = useMyShifts(profile?.uid);
  const announcements = useAnnouncements();
  const next = pickCurrent(shifts);

  return (
    <Screen title={`Hi, ${profile?.name.split(' ')[0] ?? ''}`}>
      <Card>
        <Text style={s.h2}>{next?.status === 'clocked_in' ? 'On shift now' : 'Next shift'}</Text>
        {next ? (
          <>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>{next.clientName}</Text>
            <Muted>{fmtDay(next.start.toMillis())} · {fmtTime(next.start.toMillis())}–{fmtTime(next.end.toMillis())}</Muted>
            <Muted>{next.address}</Muted>
            <Pill text={next.serviceLine} tone="blue" />
          </>
        ) : (
          <Muted>No upcoming shifts.</Muted>
        )}
      </Card>
      <Card>
        <Link href="/training" style={{ color: '#373CB6', fontWeight: '700', paddingVertical: 6 }}>Training & credentials →</Link>
        <Link href="/missed" style={{ color: '#373CB6', fontWeight: '700', paddingVertical: 6 }}>Report a missed clock-in →</Link>
      </Card>
      <Text style={s.h2}>Announcements</Text>
      {announcements.length === 0 && <Muted>Nothing new.</Muted>}
      {announcements.map((a) => (
        <Card key={a.id}>
          <Text style={{ fontWeight: '700' }}>{a.title}</Text>
          <Muted>{a.body}</Muted>
        </Card>
      ))}
      <Btn label="Log out" tone="ghost" onPress={signOutUser} />
    </Screen>
  );
}
