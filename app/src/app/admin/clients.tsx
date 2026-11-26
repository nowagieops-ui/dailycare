import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useClients, useShiftsBetween } from '../../lib/admin-data';
import { useAuth } from '../../lib/auth';
import { ALL_STATUSES, STATUS_LABEL, STATUS_TONE, statusOf, useAutoStatus } from '../../lib/clientStatus';
import { useAdminDocs } from '../../lib/ebinder';
import { colors } from '../../lib/theme';
import { Btn, Card, Chips, Muted, Screen, Tag } from '../../lib/ui';
import { addDays, startOfDay } from '../../lib/week';

export function reviewStatus(nextReview?: string): { text: string; tone: 'green' | 'amber' | 'red' | 'neutral' } {
  if (!nextReview) return { text: 'Not set', tone: 'neutral' };
  const days = Math.ceil((new Date(nextReview + 'T00:00:00').getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: 'Review overdue', tone: 'red' };
  if (days <= 30) return { text: 'Review due', tone: 'amber' };
  return { text: 'Current', tone: 'green' };
}

const W = [1.6, 1.3, 1.5, 1.8, 1.1, 0.7];

export default function ClientsDirectory() {
  const { profile } = useAuth();
  const all = useClients();
  const [filter, setFilter] = useState<string[]>([]);
  const today = startOfDay(new Date());
  const upcoming = useShiftsBetween(addDays(today, -14), addDays(today, 30));
  useAutoStatus(all, useAdminDocs(), upcoming, profile);
  const clients = filter.length ? all.filter((c) => filter.includes(statusOf(c))) : all;
  const dsps = (id: string) => [...new Set(upcoming.filter((x) => x.clientId === id && x.staffName).map((x) => x.staffName!))].join(', ') || '—';
  const cell = (i: number) => ({ flex: W[i], paddingRight: 8, justifyContent: 'center' as const });

  return (
    <Screen title="Clients Directory">
      <Chips options={ALL_STATUSES.map((k) => ({ value: k as string, label: `${STATUS_LABEL[k]} (${all.filter((c) => statusOf(c) === k).length})` }))} selected={filter}
        onToggle={(v) => setFilter((f) => (f.includes(v) ? f.filter((x) => x !== v) : [...f, v]))} />
      <View style={{ alignSelf: 'flex-end', width: 160 }}><Btn label="+ Add Client" onPress={() => router.push('/admin/add-client' as never)} /></View>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', padding: 12, backgroundColor: colors.bg }}>
          {['Name', 'Status', 'Service line', 'Assigned DSPs', 'Care plan', ''].map((h, i) => <View key={i} style={cell(i)}><Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkSoft }}>{h}</Text></View>)}
        </View>
        {clients.length === 0 && <View style={{ padding: 12 }}><Muted>No clients yet.</Muted></View>}
        {clients.map((c) => {
          const st = reviewStatus(c.nextReview);
          return (
            <Pressable key={c.id} onPress={() => router.push({ pathname: '/admin/client-detail', params: { id: c.id } } as never)}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
              <View style={cell(0)}><Text style={{ fontWeight: '600', color: colors.ink }}>{c.name}</Text></View>
              <View style={cell(1)}><Tag text={STATUS_LABEL[statusOf(c)]} tone={STATUS_TONE[statusOf(c)]} /></View>
              <View style={cell(2)}><Text style={{ color: colors.ink }}>{c.serviceLines.join(', ')}</Text></View>
              <View style={cell(3)}><Text style={{ color: colors.inkSoft, fontSize: 13 }}>{dsps(c.id)}</Text></View>
              <View style={cell(4)}><Tag text={st.text} tone={st.tone} /></View>
              <View style={cell(5)}><Text style={{ color: colors.primary, fontWeight: '600' }}>Open</Text></View>
            </Pressable>
          );
        })}
      </Card>
    </Screen>
  );
}
