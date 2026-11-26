import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../lib/theme';
import { Field, Muted } from '../lib/ui';
import type { DriveItem } from '../lib/types';

export const folderPath = (all: DriveItem[], f: DriveItem) =>
  [...f.path.map((p) => all.find((x) => x.id === p)?.name ?? ''), f.name].filter(Boolean).join(' / ');

/** Searchable folder chooser (super admins; uses the folders already loaded). */
export function FolderPick({ label, all, valueId, onPick, exclude }: {
  label: string; all: DriveItem[]; valueId?: string; onPick: (f: DriveItem) => void; exclude?: (f: DriveItem) => boolean;
}) {
  const [q, setQ] = useState('');
  const cur = all.find((f) => f.id === valueId);
  const list = all.filter((f) => !exclude?.(f)).map((f) => ({ f, label: folderPath(all, f) }))
    .filter((x) => x.label.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => a.label.localeCompare(b.label)).slice(0, 10);
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontWeight: '600', color: colors.ink }}>{label}</Text>
      <Text style={{ color: colors.inkSoft }}>Current: {cur ? folderPath(all, cur) : 'not set'}</Text>
      <Field label="Find a folder" value={q} onChangeText={setQ} />
      {list.length === 0 && <Muted>No folders match.</Muted>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {list.map(({ f, label: l }) => (
          <Pressable key={f.id} onPress={() => onPick(f)} accessibilityRole="button"
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: f.id === valueId ? colors.primary : colors.line, backgroundColor: f.id === valueId ? colors.tint : colors.paper }}>
            <Text style={{ color: f.id === valueId ? colors.primary : colors.inkSoft, fontWeight: '600' }}>{l}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
