import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { useOpenAlerts, useShiftsBetween } from '../../lib/admin-data';
import { useCredentials, useMissedRequests } from '../../lib/credentials';
import { daysLeft } from '../../lib/expiry';
import { db } from '../../lib/firebase';
import { colors } from '../../lib/theme';
import { Btn, Card, fmtDay, fmtTime, Muted, Pill, s, Screen, StatTile, Tag } from '../../lib/ui';
import { addDays, startOfWeek } from '../../lib/week';

type Activity = { at: number; tone: 'green' | 'amber' | 'neutral'; mark: string; text: string };

export default function Dashboard() {
  const alerts = useOpenAlerts();
  const credentials = useCredentials();
  const missed = useMissedRequests({});
  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const shifts = useShiftsBetween(weekStart, addDays(weekStart, 7));

  const onShift = shifts.filter((x) => x.status === 'clocked_in').length;
  const open = shifts.filter((x) => !x.staffId).length;
  const expiring = credentials.filter((c) => daysLeft(c.expiresOn.toMillis()) <= 90).length;
  const missedWeek = missed.filter((m) => m.createdAt.toMillis() >= weekStart.getTime()).length;

  const activity: Activity[] = [
    ...shifts.filter((x) => x.clockInAt).map((x): Activity => ({
      at: x.clockInAt!.toMillis(), tone: 'green', mark: '✓',
      text: `${x.staffName || 'Staff'} clocked in for ${x.clientName} — ${x.serviceLine}`,
    })),
    ...missed.map((m): Activity => ({
      at: m.createdAt.toMillis(), tone: 'amber', mark: '!',
      text: `${m.staffName} reported a missed clock-in for ${m.clientName}`,
    })),
  ].sort((a, b) => b.at - a.at).slice(0, 8);

  const quick: [string, string][] = [
    ['+ Add staff member', '/admin/add-staff'], ['Generate admin onboarding code', '/admin/add-staff'],
    ['+ Create new shift', '/admin/scheduling'], ['Upload to eBinder', '/admin/ebinders'],
  ];

  return (
    <Screen title="Dashboard">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <View style={{ minWidth: 200, flexGrow: 1 }}><StatTile label="Staff on shift now" value={onShift} /></View>
        <View style={{ minWidth: 200, flexGrow: 1 }}><StatTile label="Open shifts this week" value={open} /></View>
        <View style={{ minWidth: 200, flexGrow: 1 }}><StatTile label="Credentials expiring (90 days)" value={expiring} /></View>
        <View style={{ minWidth: 200, flexGrow: 1 }}><StatTile label="Missed clock-ins this week" value={missedWeek} /></View>
      </View>

      {alerts.length > 0 && (
        <Card style={{ borderColor: colors.red }}>
          <Text style={s.h2}>Staff outside the client's location</Text>
          {alerts.map((a) => (
            <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Pill text="Left site" tone="red" />
              <Text style={{ flex: 1, minWidth: 180, color: colors.ink }}>{a.staffName || 'Staff member'} left {a.clientName} at {fmtTime(a.at.toMillis())}</Text>
              <View style={{ width: 150 }}><Btn label="Mark resolved" tone="ghost" onPress={() => updateDoc(doc(db, 'alerts', a.id), { resolved: true })} /></View>
            </View>
          ))}
        </Card>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
        <Card style={{ flexGrow: 2, flexBasis: 420, minWidth: 280 }}>
          <Text style={s.h2}>Recent activity</Text>
          {activity.length === 0 && <Muted>Nothing yet. Clock-ins and missed clock-in reports appear here.</Muted>}
          {activity.map((a, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
              <Tag text={a.mark} tone={a.tone === 'green' ? 'green' : a.tone === 'amber' ? 'amber' : 'neutral'} />
              <Text style={{ flex: 1, fontSize: 14, color: colors.ink }}>{a.text}</Text>
              <Text style={{ fontSize: 12, color: colors.inkFaint }}>{fmtDay(a.at)} {fmtTime(a.at)}</Text>
            </View>
          ))}
          <Pressable onPress={() => router.push('/admin/audit' as never)}><Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>View full audit log →</Text></Pressable>
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 260, minWidth: 240 }}>
          <Text style={s.h2}>Quick actions</Text>
          {quick.map(([label, href]) => (
            <Pressable key={label} accessibilityRole="link" onPress={() => router.push(href as never)}
              style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.tint }}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{label}</Text>
            </Pressable>
          ))}
        </Card>
      </View>
    </Screen>
  );
}
