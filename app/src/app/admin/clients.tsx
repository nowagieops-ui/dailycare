import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useClients, useShiftsBetween } from '../../lib/admin-data';
import { colors } from '../../lib/theme';
import { Btn, Card, Muted, Screen, Tag } from '../../lib/ui';
import { addDays, startOfDay } from '../../lib/week';

export function reviewStatus(nextReview?: string): { text: string; tone: 'green' | 'amber' | 'red' | 'neutral' } {
  if (!nextReview) return { text: 'Not set', tone: 'neutral' };
  const days = Math.ceil((new Date(nextReview + 'T00:00:00').getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: 'Review overdue', tone: 'red' };
  if (days <= 30) return { text: 'Review due', tone: 'amber' };
  return { text: 'Current', tone: 'green' };
}

const W = [1.6, 1.8, 2.2, 1.2, 0.8];

export default function ClientsDirectory() {
  const clients = useClients();
  const today = startOfDay(new Date());
  const upcoming = useShiftsBetween(addDays(today, -14), addDays(today, 30));
  const dsps = (id: string) => [...new Set(upcoming.filter((x) => x.clientId === id && x.staffName).map((x) => x.staffName!))].join(', ') || '—';
  const cell = (i: number) => ({ flex: W[i], paddingRight: 8, justifyContent: 'center' as const });

  return (
    <Screen title="Clients Directory">
      <View style={{ alignSelf: 'flex-end', width: 160 }}><Btn label="+ Add Client" onPress={() => router.push('/admin/add-client' as never)} /></View>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', padding: 12, backgroundColor: colors.bg }}>
          {['Name', 'Service line', 'Assigned DSPs', 'Care plan', ''].map((h, i) => <View key={i} style={cell(i)}><Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkSoft }}>{h}</Text></View>)}
        </View>
        {clients.length === 0 && <View style={{ padding: 12 }}><Muted>No clients yet.</Muted></View>}
        {clients.map((c) => {
          const st = reviewStatus(c.nextReview);
          return (
            <Pressable key={c.id} onPress={() => router.push({ pathname: '/admin/client-detail', params: { id: c.id } } as never)}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
              <View style={cell(0)}><Text style={{ fontWeight: '600', color: colors.ink }}>{c.name}</Text></View>
              <View style={cell(1)}><Text style={{ color: colors.ink }}>{c.serviceLines.join(', ')}</Text></View>
              <View style={cell(2)}><Text style={{ color: colors.inkSoft, fontSize: 13 }}>{dsps(c.id)}</Text></View>
              <View style={cell(3)}><Tag text={st.text} tone={st.tone} /></View>
              <View style={cell(4)}><Text style={{ color: colors.primary, fontWeight: '600' }}>Open</Text></View>
            </Pressable>
          );
        })}
      </Card>
    </Screen>
  );
}
