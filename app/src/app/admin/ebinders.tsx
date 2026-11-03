import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useStaff } from '../../lib/admin-data';
import { audienceLabel, FOLDERS, useAdminDocs, useSignatures, type EDoc } from '../../lib/ebinder';
import { colors } from '../../lib/theme';
import { Btn, Card, Chips, fmtDay, Muted, Screen, Tag } from '../../lib/ui';

/** Signed count for one document (own listener per row; the list is short). */
export function useSignedCount(d: EDoc) {
  const staff = useStaff().filter((u) => (u.role === 'staff' || u.role === 'family_staff') && u.active);
  const sigs = useSignatures(d.requiresSignature ? d.id : undefined).filter((x) => x.version === d.version);
  const targets = d.audience === 'all_staff' ? staff : d.audience === 'assigned' ? staff.filter((u) => d.assignedTo.includes(u.id)) : [];
  const signed = targets.filter((u) => sigs.some((x) => x.staffId === u.id)).length;
  return { signed, total: targets.length };
}

function Row({ d, W }: { d: EDoc; W: number[] }) {
  const { signed, total } = useSignedCount(d);
  const status = !d.requiresSignature ? <Tag text="Current" tone="green" />
    : total === 0 ? <Tag text="No recipients" />
    : signed === total ? <Tag text={`${signed} / ${total} signed`} tone="green" />
    : <Tag text={`${signed} / ${total} signed`} tone="amber" />;
  return (
    <Pressable onPress={() => router.push({ pathname: '/admin/document-detail', params: { id: d.id } } as never)}
      style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
      <View style={{ flex: W[0], paddingRight: 8 }}><Text style={{ fontWeight: '600', color: colors.ink }}>{d.title}</Text></View>
      <View style={{ flex: W[1], paddingRight: 8 }}><Text style={{ color: colors.inkSoft }}>{d.folder}</Text></View>
      <View style={{ flex: W[2], paddingRight: 8 }}><Text>v{d.version}</Text></View>
      <View style={{ flex: W[3], paddingRight: 8 }}><Text style={{ color: colors.inkSoft }}>{fmtDay(d.updatedAt.toMillis())}</Text></View>
      <View style={{ flex: W[4], paddingRight: 8 }}>{status}</View>
      <View style={{ flex: W[5], paddingRight: 8 }}><Text style={{ color: colors.inkSoft }}>{audienceLabel[d.audience]}</Text></View>
    </Pressable>
  );
}

export default function EBinders() {
  const docs = useAdminDocs();
  const [folder, setFolder] = useState<string[]>([]);
  const shown = folder.length ? docs.filter((d) => d.folder === folder[0]) : docs;
  const W = [2.4, 1.4, 0.6, 1.2, 1.4, 1.2];

  return (
    <Screen title="Compliance Documents">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 240 }}><Chips options={FOLDERS.map((f) => ({ value: f as string, label: f }))} selected={folder} onToggle={(v) => setFolder((c) => (c[0] === v ? [] : [v]))} /></View>
        <View style={{ width: 190 }}><Btn label="Upload document" onPress={() => router.push('/admin/ebinder-new' as never)} /></View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {FOLDERS.map((f) => (
          <Card key={f} style={{ minWidth: 180, flexGrow: 1 }}>
            <Text style={{ fontWeight: '700', color: colors.navy }}>{f}</Text>
            <Muted>{docs.filter((d) => d.folder === f).length} documents</Muted>
          </Card>
        ))}
      </View>
      <Card style={{ padding: 0 }}>
        <ScrollView horizontal>
          <View style={{ minWidth: 820, flex: 1 }}>
            <View style={{ flexDirection: 'row', padding: 12, backgroundColor: colors.bg }}>
              {['Document', 'Folder', 'Version', 'Last updated', 'Status', 'Visibility'].map((h, i) => <View key={h} style={{ flex: W[i], paddingRight: 8 }}><Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkSoft }}>{h}</Text></View>)}
            </View>
            {shown.length === 0 && <View style={{ padding: 12 }}><Muted>No documents yet. Use "Upload document" to add one.</Muted></View>}
            {shown.map((d) => <Row key={d.id} d={d} W={W} />)}
          </View>
        </ScrollView>
      </Card>
    </Screen>
  );
}
