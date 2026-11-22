import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStaff, useClients } from '../lib/admin-data';
import { createFolder, deleteItem, fileUrl, myKeys, importTree, saveShares, syncClientFolders, zipEntries, uploadFile, useAllFolders, useFolder } from '../lib/drive';
import { useFolderTemplate } from '../lib/ebinder';
import { roleKey, type Share } from '../lib/drive-access';
import { colors, radius } from '../lib/theme';
import type { DriveItem, Role } from '../lib/types';
import { Btn, Card, Chips, Field, Muted, s, Tag } from '../lib/ui';

interface Props { mode: 'super' | 'staff'; uid: string; role: Role; name?: string; startFolderId?: string }

const ROLES = [
  { value: roleKey('staff'), label: 'All staff' },
  { value: roleKey('family_staff'), label: 'All Family DSPs' },
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

const fmtSize = (n?: number) => (n == null ? '–' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);
const fmtDate = (it: DriveItem) => it.createdAt?.toDate().toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) ?? '–';
const W = [3, 1.6, 0.8, 1.8, 1.4, 1.5];
const Head = ({ flex, t }: { flex: number; t: string }) => <View style={{ flex, paddingRight: 8 }}><Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkSoft }}>{t}</Text></View>; // Name, eBinder, Size, Date modified, Updated by, Actions

/** Folder tree on the left (super admin): click to jump, arrow to expand. */
function Tree({ folders, trail, onGo }: { folders: DriveItem[]; trail: DriveItem[]; onGo: (f: DriveItem | null) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const kids = useMemo(() => {
    const m = new Map<string | null, DriveItem[]>();
    for (const f of folders) m.set(f.parentId, [...(m.get(f.parentId) ?? []), f]);
    for (const l of m.values()) l.sort((a, b) => a.name.localeCompare(b.name));
    return m;
  }, [folders]);
  const here = trail[trail.length - 1]?.id ?? null;
  const row = (f: DriveItem, depth: number): React.ReactNode => {
    const sub = kids.get(f.id) ?? [];
    const expanded = open[f.id] || trail.some((t) => t.id === f.id);
    return (
      <View key={f.id}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: depth * 14, backgroundColor: here === f.id ? colors.tint : 'transparent', borderRadius: 6 }}>
          <Pressable onPress={() => setOpen((o) => ({ ...o, [f.id]: !expanded }))} style={{ width: 24, alignItems: 'center', paddingVertical: 6 }} accessibilityLabel={expanded ? 'Collapse' : 'Expand'}>
            {sub.length > 0 ? <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={14} color={colors.inkSoft} /> : null}
          </Pressable>
          <Pressable onPress={() => onGo(f)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
            <Ionicons name="folder" size={16} color="#E8B93C" />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: colors.ink, fontWeight: here === f.id ? '700' : '500' }}>{f.name}</Text>
          </Pressable>
        </View>
        {expanded && sub.map((k) => row(k, depth + 1))}
      </View>
    );
  };
  return (
    <View style={{ gap: 2 }}>
      <Pressable onPress={() => onGo(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6, backgroundColor: here === null ? colors.tint : 'transparent', borderRadius: 6 }}>
        <Ionicons name="home-outline" size={16} color={colors.primary} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>All files</Text>
      </Pressable>
      {(kids.get(null) ?? []).map((f) => row(f, 0))}
    </View>
  );
}

export function DriveBrowser({ mode, uid, role, name = '', startFolderId }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 900 && mode === 'super';
  // Space left for the table after the admin sidebar (248), folder tree (270) and padding. Columns drop out as it shrinks.
  const avail = width - (width >= 900 ? 248 : 0) - (wide ? 270 + 16 : 0) - 32;
  const showBy = avail >= 820, showEb = avail >= 700, showDate = avail >= 520, showSize = avail >= 440;
  const [trail, setTrail] = useState<DriveItem[]>([]);
  const here = trail[trail.length - 1] ?? null;
  const items = useFolder(here?.id ?? null, mode, myKeys(uid, role));
  const { items: allFolders, loaded } = useAllFolders(mode === 'super');
  const staff = useStaff().filter((u) => u.role === 'staff' || u.role === 'family_staff');
  const clients = useClients();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [find, setFind] = useState('');
  const [msg, setMsg] = useState('');
  const [sharing, setSharing] = useState<DriveItem | null>(null);
  const [viewKeys, setViewKeys] = useState<string[]>([]);
  const [upKeys, setUpKeys] = useState<string[]>([]);

  const mine = (k: string) => k === uid || k === roleKey(role);
  const canUpload = mode === 'super' || (here !== null && here.uploaders.some(mine));
  const web = Platform.OS === 'web';
  const office = mode === 'super';
  const byId = useMemo(() => new Map(allFolders.map((f) => [f.id, f])), [allFolders]);

  // Every client gets a folder (with the eBinder subfolders) so documents can be filed straight away.
  const template = useFolderTemplate();
  const synced = useRef('');
  useEffect(() => {
    if (mode !== 'super' || !loaded || clients.length === 0) return;
    const key = `${clients.length}:${allFolders.length}:${template.join('|')}`;
    if (synced.current === key) return;
    synced.current = key;
    syncClientFolders(clients, new Set(allFolders.map((f) => f.id)), uid, name, template).catch(() => {});
  }, [mode, loaded, clients.length, allFolders.length, template.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open at a requested folder (e.g. from a client's eBinder tab).
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !startFolderId) return;
    const f = byId.get(startFolderId);
    if (f) { opened.current = true; goTo(f); }
  }, [byId, startFolderId]); // eslint-disable-line react-hooks/exhaustive-deps

  function goTo(f: DriveItem | null) {
    setFind(''); setSharing(null); setCreating(false);
    if (!f) return setTrail([]);
    setTrail([...f.path, f.id].map((id) => (id === f.id ? f : byId.get(id))).filter(Boolean) as DriveItem[]);
  }
  const back = () => setTrail((t) => t.slice(0, -1));

  function pickFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async () => {
      for (const f of Array.from(input.files ?? [])) {
        const problem = await uploadFile(f, here, uid, name, office);
        setMsg(problem ?? `Uploaded ${f.name}`);
        if (problem) return;
      }
    };
    input.click();
  }

  /** Bulk import from a ZIP or a whole folder (for moving documents over from the old system). */
  function importBulk(kind: 'zip' | 'folder') {
    const input = document.createElement('input');
    input.type = 'file';
    if (kind === 'zip') input.accept = '.zip,application/zip';
    else { input.multiple = true; (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true; }
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) return;
      try {
        setMsg('Reading files…');
        const entries = kind === 'zip'
          ? await zipEntries(files[0])
          : files.map((f) => ({ path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, file: f }));
        // A picked folder's own name is part of its paths; a ZIP's top-level folders are kept as they are.
        const r = await importTree(entries, here, uid, name, office, (d, t) => setMsg(`Importing ${d} of ${t}…`));
        setMsg(`Imported ${r.files} file${r.files === 1 ? '' : 's'} and ${r.folders} new folder${r.folders === 1 ? '' : 's'}.${r.skipped.length ? ` Skipped ${r.skipped.length}: ${r.skipped.slice(0, 3).join('; ')}${r.skipped.length > 3 ? '…' : ''}` : ''}`);
      } catch {
        setMsg('Import failed. Check the ZIP and your permissions, then try again.');
      }
    };
    input.click();
  }

  async function open(item: DriveItem) {
    if (item.type === 'folder') { setFind(''); return setTrail((t) => [...t, item]); }
    try {
      const url = await fileUrl(item);
      if (web) window.open(url, '_blank', 'noopener');
      else await Linking.openURL(url);
    } catch { setMsg('Could not open that file.'); }
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
  async function remove(it: DriveItem) {
    const extra = it.type === 'folder' ? ' and everything inside it' : '';
    const linked = it.ebinderDocId && !it.fromEbinder ? ' Its eBinder document is deleted too.' : it.fromEbinder ? ' The eBinder copy stays.' : '';
    if (await confirmAsk(`Delete "${it.name}"${extra}?${linked} This cannot be undone.`)) await deleteItem(it);
  }

  const toggle = (set: (f: (c: string[]) => string[]) => void) => (v: string) =>
    set((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]));
  const people = [...ROLES, ...staff.map((u) => ({ value: u.id, label: u.name }))];
  const shown = find.trim() ? items.filter((i) => i.name.toLowerCase().includes(find.trim().toLowerCase())) : items;

  const main = (
    <View style={{ flex: 1, gap: 12, minWidth: 0, width: '100%' }}>
      {/* Path bar: Back goes up one folder; every part of the path is clickable. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={back} disabled={trail.length === 0} accessibilityRole="button" accessibilityLabel="Back one folder"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, paddingRight: 10, paddingLeft: 4, borderRadius: 8, backgroundColor: colors.tint, opacity: trail.length === 0 ? 0.4 : 1 }}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Back</Text>
        </Pressable>
        <View style={{ flex: 1, minWidth: 160, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
          <Pressable onPress={() => goTo(null)}><Text style={{ color: colors.primary, fontWeight: '700' }}>{mode === 'super' ? 'All files' : 'Shared with me'}</Text></Pressable>
          {trail.map((c, i) => (
            <Pressable key={c.id} onPress={() => setTrail(trail.slice(0, i + 1))}>
              <Text style={{ color: i === trail.length - 1 ? colors.ink : colors.primary, fontWeight: '700' }}>  /  {c.name}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 10, flexGrow: 1, flexBasis: 200, maxWidth: 320 }}>
          <Ionicons name="search" size={15} color={colors.inkFaint} />
          <TextInput value={find} onChangeText={setFind} placeholder="Search in this folder…" placeholderTextColor={colors.inkFaint}
            style={{ flex: 1, paddingVertical: 8, fontSize: 13, color: colors.ink, outlineStyle: 'none' } as never} />
        </View>
      </View>

      {/* Toolbar */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {mode === 'super' && <View style={{ minWidth: 150, flexShrink: 0 }}><Btn label="＋ Create folder" onPress={() => setCreating((c) => !c)} tone={creating ? 'ghost' : 'primary'} /></View>}
        {canUpload && (web
          ? <>
              <View style={{ minWidth: 150, flexShrink: 0 }}><Btn label="Upload files" tone="ghost" onPress={pickFile} /></View>
              {office && <View style={{ minWidth: 150, flexShrink: 0 }}><Btn label="Import ZIP" tone="ghost" onPress={() => importBulk('zip')} /></View>}
              {office && <View style={{ minWidth: 150, flexShrink: 0 }}><Btn label="Upload folder" tone="ghost" onPress={() => importBulk('folder')} /></View>}
            </>
          : <Muted>Uploading is available from the web dashboard.</Muted>)}
        {here?.clientId && office ? <Muted>Files added here also appear in this client's eBinder.</Muted> : null}
      </View>
      {creating && (
        <Card>
          <Field label={`New folder in ${here?.name ?? 'All files'}`} value={newName} onChangeText={setNewName} />
          <Btn label="Create folder" disabled={!newName.trim()} onPress={async () => { await createFolder(newName, here, uid, name); setNewName(''); setCreating(false); }} />
        </Card>
      )}
      <Muted>PDF, Word, Excel, PNG, JPEG, TXT or CSV, up to 25 MB each.</Muted>
      {msg ? <Text style={{ color: colors.inkSoft }}>{msg}</Text> : null}

      {/* File list */}
      <Card style={{ padding: 0 }}>
        <View>
          <View style={{ flexDirection: 'row', padding: 12, backgroundColor: colors.bg }}>
            <Head flex={W[0]} t="Item name" />
            {showEb && <Head flex={W[1]} t="eBinder" />}
            {showSize && <Head flex={W[2]} t="Size" />}
            {showDate && <Head flex={W[3]} t="Date modified" />}
            {showBy && <Head flex={W[4]} t="Updated by" />}
            <Head flex={W[5]} t="" />
          </View>
          {shown.length === 0 && (
            <View style={{ padding: 12 }}>
              <Muted>{find.trim() ? 'Nothing here matches your search.' : mode === 'staff' && !here ? 'Nothing has been shared with you yet.' : 'This folder is empty.'}</Muted>
            </View>
          )}
          {shown.map((it) => (
            <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
              <Pressable onPress={() => open(it)} accessibilityRole="button" style={{ flex: W[0], minWidth: 0, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name={it.type === 'folder' ? 'folder' : 'document-text-outline'} size={22} color={it.type === 'folder' ? '#E8B93C' : colors.inkSoft} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={{ fontWeight: '600', color: colors.ink }}>{it.name}</Text>
                  {/* Details that no longer have a column fold under the name. */}
                  {(!showSize || !showDate) && (
                    <Text style={{ color: colors.inkFaint, fontSize: 12 }}>
                      {[!showSize && it.type === 'file' ? fmtSize(it.size) : '', !showDate ? fmtDate(it) : ''].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </View>
              </Pressable>
              {showEb && (
                <View style={{ flex: W[1], paddingRight: 8 }}>
                  {it.ebinderDocId ? <Tag text={`eBinder · ${it.ebinderFolder || 'General'}`} tone="blue" /> : it.clientId && it.type === 'folder' ? <Tag text="Client folder" tone="neutral" /> : null}
                </View>
              )}
              {showSize && <View style={{ flex: W[2], paddingRight: 8 }}><Text style={{ color: colors.inkSoft }}>{it.type === 'file' ? fmtSize(it.size) : '–'}</Text></View>}
              {showDate && <View style={{ flex: W[3], paddingRight: 8 }}><Text style={{ color: colors.inkSoft, fontSize: 13 }}>{fmtDate(it)}</Text></View>}
              {showBy && <View style={{ flex: W[4], paddingRight: 8 }}><Text style={{ color: colors.inkSoft, fontSize: 13 }}>{it.ownerName || '–'}</Text></View>}
              <View style={{ flex: W[5], flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-end' }}>
                {mode === 'super' && (
                  <>
                    <Pressable onPress={() => startShare(it)} accessibilityRole="button">
                      <Text style={{ color: colors.primary, fontWeight: '700' }}>{it.ownShares.length ? `Shared (${it.ownShares.length})` : 'Share'}</Text>
                    </Pressable>
                    <Pressable onPress={() => remove(it)} accessibilityRole="button"><Text style={{ color: colors.red, fontWeight: '700' }}>Delete</Text></Pressable>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>
      </Card>

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

  if (!wide) return main;
  return (
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
      <Card style={{ width: 270, flexShrink: 0, padding: 10 }}><Tree folders={allFolders} trail={trail} onGo={goTo} /></Card>
      {main}
    </View>
  );
}
