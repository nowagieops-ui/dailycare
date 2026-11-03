import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useCredentials } from '../../lib/credentials';
import { daysLeft } from '../../lib/expiry';
import { pickCurrent, useAnnouncements, useMyShifts } from '../../lib/shifts';
import { StaffScreen } from '../../lib/staff-ui';
import { colors } from '../../lib/theme';
import { Btn, Card, Eyebrow, fmtTime, Muted, RowLink, s, StatTile, Tag } from '../../lib/ui';
import { greeting, hoursWorked, sameDay, startOfWeek, addDays } from '../../lib/week';

export default function Home() {
  const { profile } = useAuth();
  const { shifts } = useMyShifts(profile?.uid, 24 * 8);
  const announcements = useAnnouncements();
  const creds = useCredentials(profile?.uid);
  const now = new Date();
  const next = pickCurrent(shifts);
  const isToday = next ? sameDay(new Date(next.start.toMillis()), now) : false;
  const hours = hoursWorked(shifts, startOfWeek(now), addDays(startOfWeek(now), 7));
  const tasksDue = next?.status === 'clocked_in' || (next && isToday) ? next.tasks.filter((t) => !t.done).length : 0;
  const latest = announcements[0];
  const fresh = latest && Date.now() - latest.createdAt.toMillis() < 48 * 3600 * 1000;
  const soonest = creds.find((c) => daysLeft(c.expiresOn.toMillis()) <= 90);

  return (
    <StaffScreen title="">
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.navy }}>
          {greeting(now)}, {profile?.name.split(' ')[0]}
        </Text>
        <Muted>{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</Muted>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Eyebrow>{isToday ? "Today's shift" : 'Next shift'}</Eyebrow>
          {next && <Tag text={next.status === 'clocked_in' ? 'In progress' : 'Upcoming'} tone={next.status === 'clocked_in' ? 'green' : 'blue'} />}
        </View>
        {next ? (
          <>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>{next.clientName} — {next.serviceLine}</Text>
            <Muted>{isToday ? '' : `${new Date(next.start.toMillis()).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · `}{fmtTime(next.start.toMillis())} – {fmtTime(next.end.toMillis())}</Muted>
            <Muted>{next.address}</Muted>
            <Btn label={next.status === 'clocked_in' ? 'Open shift' : 'Clock In'} onPress={() => router.push('/clock-in')} />
          </>
        ) : (
          <Muted>No upcoming shifts.</Muted>
        )}
      </Card>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatTile label="Hours this week" value={hours} />
        <StatTile label="Tasks due today" value={tasksDue} />
      </View>

      {latest && (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Eyebrow>Agency announcement</Eyebrow>
            {fresh && <Tag text="New" />}
          </View>
          <Text style={{ fontWeight: '700' }}>{latest.title}</Text>
          <Text style={{ fontSize: 14, color: colors.ink }}>{latest.body}</Text>
        </Card>
      )}

      <RowLink
        icon="school-outline" title="Training & Credentials" href="/training"
        sub={soonest ? `${soonest.title} ${daysLeft(soonest.expiresOn.toMillis()) < 0 ? 'has expired' : `expires in ${daysLeft(soonest.expiresOn.toMillis())} days`}` : 'All up to date'}
      />
    </StaffScreen>
  );
}
