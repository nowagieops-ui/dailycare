import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, Text, View } from 'react-native';
import { useStaff } from '../lib/admin-data';
import { createFolder, deleteItem, fileUrl, myKeys, saveShares, uploadFile, useFolder } from '../lib/drive';
import { roleKey, type Share } from '../lib/drive-access';
import { colors } from '../lib/theme';
import type { DriveItem, Role } from '../lib/types';
import { Btn, Card, Chips, Field, Muted, s } from '../lib/ui';

interface Props { mode: 'super' | 'staff'; uid: string; role: Role }
type Crumb = DriveItem;

const ROLES = [
  { value: roleKey('staff'), label: 'All staff' },
  { value: roleKey('family_staff'), label: 'All Family Staff' },
  { value: roleKey('admin'), label: 'All admins' },
];

function confirmAsk(message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message));
  return new Promise((res) =>
    Alert.alert('Are you sure?', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => res(false) },
      { text: 'Delete', style: 'destructive', onPress: () => res(true) },
    ]),
  );
}

const fmtSize = (n?: number) => (n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

export function DriveBrowser({ mode, uid, role }: Props) {
  const [trail, setTrail] = useState<Crumb[]>([]);
  const here = trail[trail.length - 1] ?? null;
  const items = useFolder(here?.id ?? null, mode, myKeys(uid, role));
  const staff = useStaff().filter((u) => u.role === 'staff' || u.role === 'family_staff');
  const [newName, setNewName] = useState('');
  const [msg, setMsg] = useState('');
  const [sharing, setSharing] = useState<DriveItem | null>(null);
  const [viewKeys, setViewKeys] = useState<string[]>([]);
  const [upKeys, setUpKeys] = useState<string[]>([]);

  const mine = (k: string) => k === uid || k === roleKey(role);
  const canUpload = mode === 'super' || (here !== null && here.uploaders.some(mine));
  const web = Platform.OS === 'web';

  function pickFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      for (const f of files) {
        const problem = await uploadFile(f, here, uid);
        setMsg(problem ?? `Uploaded ${f.name}`);
        if (problem) return;
      }
    };
    input.click();
  }

  async function open(item: DriveItem) {
    if (item.type === 'folder') return setTrail([...trail, item]);
    try {
      const url = await fileUrl(item);
      if (web) window.open(url, '_blank', 'noopener');
      else await Linking.openURL(url);
    } catch {
      setMsg('Could not open that file.');
    }
  }

  function startShare(item: DriveItem) {
    setSharing(item);
    setViewKeys(item.ownShares.filter((x) => x.level === 'view').map((x) => x.key));
    setUpKeys(item.ownShares.filter((x) => x.level === 'upload').map((x) => x.key));
  }

  async function commitShare() {
    if (!sharing) return;
    const own: Share[] = [
      ...upKeys.map((key) => ({ key, level: 'upload' as const })),
      ...viewKeys.filter((k) => !upKeys.includes(k)).map((key) => ({ key, level: 'view' as const })),
    ];
    await saveShares(sharing, own);
    setMsg(`Sharing updated for "${sharing.name}".`);
    setSharing(null);
  }

  const toggle = (set: (f: (c: string[]) => string[]) => void) => (v: string) =>
    set((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]));
  const people = [...ROLES, ...staff.map((u) => ({ value: u.id, label: u.name }))];

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <Pressable onPress={() => setTrail([])}><Text style={{ color: colors.primary, fontWeight: '700' }}>Files</Text></Pressable>
        {trail.map((c, i) => (
          <Pressable key={c.id} onPress={() => setTrail(trail.slice(0, i + 1))}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>/ {c.name}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'super' && (
        <Card>
          <Field label="New folder name" value={newName} onChangeText={setNewName} />
          <Btn label="Create folder" disabled={!newName.trim()} onPress={async () => { await createFolder(newName, here, uid); setNewName(''); }} />
        </Card>
      )}
      {canUpload && (web
        ? <Btn label="Upload files" onPress={pickFile} />
        : <Muted>Uploading is available from the web dashboard.</Muted>)}
      <Muted>PDF, Word, Excel, PNG, JPEG, TXT or CSV, up to 25 MB each.</Muted>
      {msg ? <Text style={{ color: colors.inkSoft }}>{msg}</Text> : null}

      {items.length === 0 && <Muted>{mode === 'staff' && !here ? 'Nothing has been shared with you yet.' : 'This folder is empty.'}</Muted>}
      {items.map((it) => (
        <Card key={it.id}>
          <Pressable onPress={() => open(it)} accessibilityRole="button">
            <Text style={s.h2}>{it.type === 'folder' ? '📁 ' : '📄 '}{it.name}</Text>
            {it.type === 'file' && <Muted>{fmtSize(it.size)}</Muted>}
          </Pressable>
          {mode === 'super' && (
            <>
              <Muted>
                {it.ownShares.length === 0 ? 'Not shared directly' : `Shared with ${it.ownShares.length} ${it.ownShares.length === 1 ? 'person/group' : 'people/groups'}`}
              </Muted>
              <Btn label="Share" tone="ghost" onPress={() => startShare(it)} />
              <Btn
                label="Delete" tone="danger"
                onPress={async () => {
                  const extra = it.type === 'folder' ? ' and everything inside it' : '';
                  if (await confirmAsk(`Delete "${it.name}"${extra}? This cannot be undone.`)) await deleteItem(it);
                }}
              />
            </>
          )}
        </Card>
      ))}

      {sharing && (
        <Card>
          <Text style={s.h2}>Share "{sharing.name}"</Text>
          {sharing.type === 'folder' && <Muted>Sharing a folder shares everything inside it, including files added later.</Muted>}
          <Text style={{ fontWeight: '600' }}>Can view</Text>
          <Chips options={people} selected={viewKeys} onToggle={toggle(setViewKeys)} />
          {sharing.type === 'folder' && (
            <>
              <Text style={{ fontWeight: '600' }}>Can view and upload</Text>
              <Chips options={people} selected={upKeys} onToggle={toggle(setUpKeys)} />
            </>
          )}
          <Btn label="Save sharing" onPress={commitShare} />
          <Btn label="Cancel" tone="ghost" onPress={() => setSharing(null)} />
        </Card>
      )}
    </View>
  );
}
