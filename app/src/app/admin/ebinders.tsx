import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useStaff } from '../../lib/admin-data';
import { useAuth } from '../../lib/auth';
import { useClients } from '../../lib/admin-data';
import { ensureClientFolder, renameCategoryEverywhere } from '../../lib/drive';
import { audienceLabel, saveFolderTemplate, useAdminDocs, useFolderTemplate, useSignatures, type EDoc } from '../../lib/ebinder';
import { colors } from '../../lib/theme';
import { Btn, Card, Chips, Field, fmtDay, Muted, Screen, s, Tag } from '../../lib/ui';

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
  const template = useFolderTemplate();
  const { profile } = useAuth();
  const clients = useClients();
  const [newName, setNewName] = useState('');
  const [tplMsg, setTplMsg] = useState('');
  const folders = [...template, ...[...new Set(docs.map((d) => d.folder))].filter((f) => !template.includes(f)).sort()];

  async function addCategory() {
    const n = newName.trim();
    if (!n || template.some((f) => f.toLowerCase() === n.toLowerCase())) { setTplMsg('That folder already exists.'); return; }
    await saveFolderTemplate([...template, n]);
    setNewName(''); setTplMsg(`Adding "${n}" to every client…`);
    if (profile) for (const c of clients) await ensureClientFolder(c, n, profile.uid, profile.name).catch(() => {});
    setTplMsg(`"${n}" added to all ${clients.length} clients. New clients get it automatically.`);
  }
  const [renFrom, setRenFrom] = useState<string | null>(null);
  const [renTo, setRenTo] = useState('');
  async function commitRename() {
    const to = renTo.trim();
    if (!renFrom || !to || to === renFrom) { setRenFrom(null); return; }
    if (template.some((f) => f.toLowerCase() === to.toLowerCase() && f !== renFrom)) { setTplMsg('That folder name is already used.'); return; }
    setTplMsg('Renaming everywhere…');
    try {
      await saveFolderTemplate(template.map((f) => (f === renFrom ? to : f)));
      await renameCategoryEverywhere(renFrom, to);
      setTplMsg(`"${renFrom}" is now "${to}" for every client, in eBinders and the file manager.`);
      setFolder([]);
    } catch { setTplMsg('Could not rename. Try again.'); }
    setRenFrom(null);
  }
  async function removeCategory(f: string) {
    await saveFolderTemplate(template.filter((x) => x !== f));
    setTplMsg(`"${f}" removed from the template. Existing client folders and their documents are kept; new clients won't get it.`);
  }
  const shown = folder.length ? docs.filter((d) => d.folder === folder[0]) : docs;
  const W = [2.4, 1.4, 0.6, 1.2, 1.4, 1.2];

  return (
    <Screen title="Compliance Documents">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 240 }}><Chips options={folders.map((f) => ({ value: f as string, label: f }))} selected={folder} onToggle={(v) => setFolder((c) => (c[0] === v ? [] : [v]))} /></View>
        <View style={{ width: 190 }}><Btn label="Upload document" onPress={() => router.push('/admin/ebinder-new' as never)} /></View>
      </View>
      <Card>
        <Text style={s.h2}>Client folder template</Text>
        <Muted>Every client gets these folders (in their eBinder and the file manager). Add or remove categories here.</Muted>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {template.map((f) => (
            <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.tint, borderRadius: 999, paddingVertical: 6, paddingLeft: 12, paddingRight: 8 }}>
              <Text style={{ fontWeight: '600', color: colors.navy }}>{f}</Text>
              {profile?.role === 'super_admin' && <Pressable onPress={() => { setRenFrom(f); setRenTo(f); }} accessibilityRole="button" accessibilityLabel={`Rename ${f}`}><Text style={{ fontSize: 13, color: colors.primary, fontWeight: '700' }}>Rename</Text></Pressable>}
              <Pressable onPress={() => removeCategory(f)} accessibilityRole="button" accessibilityLabel={`Remove ${f}`}><Text style={{ fontSize: 16, color: colors.red, fontWeight: '800' }}>×</Text></Pressable>
            </View>
          ))}
        </View>
        {renFrom && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <View style={{ flex: 1, minWidth: 200 }}><Field label={`Rename "${renFrom}" to`} value={renTo} onChangeText={setRenTo} /></View>
            <View style={{ width: 110 }}><Btn label="Save" onPress={commitRename} disabled={!renTo.trim()} /></View>
            <View style={{ width: 110 }}><Btn label="Cancel" tone="ghost" onPress={() => setRenFrom(null)} /></View>
          </View>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <View style={{ flex: 1, minWidth: 200 }}><Field label="New folder name" value={newName} onChangeText={setNewName} /></View>
          <View style={{ width: 150 }}><Btn label="Add folder" onPress={addCategory} disabled={!newName.trim()} /></View>
        </View>
        {tplMsg ? <Muted>{tplMsg}</Muted> : null}
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {folders.map((f) => (
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
