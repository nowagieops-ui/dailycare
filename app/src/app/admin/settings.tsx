import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { FolderPick } from '../../components/FolderPick';
import { useAuth } from '../../lib/auth';
import { audit } from '../../lib/audit';
import { useAllFolders } from '../../lib/drive';
import { db } from '../../lib/firebase';
import { usePrefs } from '../../lib/prefs';
import { colors } from '../../lib/theme';
import { canAdminister, SERVICE_LINES } from '../../lib/types';
import { Btn, Card, Field, Muted, s, Screen, Tag } from '../../lib/ui';

const ROLES: [string, string[]][] = [
  ['Super Admin', ['Full access', 'Full access', 'Full access', 'Full access', 'File manager']],
  ['Office Admin', ['Full access', 'DSPs & Family DSPs only', 'Full access', 'Full access', '—']],
  ['DSP / Family DSP', ['Own shifts', '—', 'Own documents', '—', 'Shared with them']],
];
const COLS = ['Role', 'Scheduling', 'DSPs & Clients', 'eBinders', 'Reports', 'Files'];

export default function AdminSettings() {
  const { profile, signOutUser } = useAuth();
  const { prefs, set } = usePrefs(profile?.uid);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [msg, setMsg] = useState('');
  const canEdit = canAdminister(profile?.role);
  const isSuper = profile?.role === 'super_admin';
  const { items: folders } = useAllFolders(isSuper);
  const [dspFolders, setDspFolders] = useState<{ activeId?: string; inactiveId?: string }>({});
  useEffect(() => onSnapshot(doc(db, 'settings', 'dspFolders'), (d) => setDspFolders((d.data() as typeof dspFolders) ?? {}), () => {}), []);
  const saveDspFolder = async (k: 'activeId' | 'inactiveId', id: string, label: string) => {
    await setDoc(doc(db, 'settings', 'dspFolders'), { ...dspFolders, [k]: id });
    audit(profile, 'dsp', `Set the ${label} DSP folder`);
  };

  useEffect(() => onSnapshot(doc(db, 'settings', 'agency'), (d) => {
    const v = d.data();
    if (v) { setName(v.name ?? ''); setPhone(v.phone ?? ''); setAddress(v.address ?? ''); }
  }, () => {}), []);

  async function save() {
    await setDoc(doc(db, 'settings', 'agency'), { name: name.trim(), phone: phone.trim(), address: address.trim() });
    setMsg('Saved.');
  }

  return (
    <Screen title="Settings">
      {isSuper && (
        <Card>
          <Text style={s.h2}>Where DSP records are filed</Text>
          <Muted>Set these once. When a DSP is deactivated, their records folder moves to the inactive/discharge folder; when reactivated it moves back to the active folder.</Muted>
          <FolderPick label="Active DSPs folder" all={folders.filter((f) => !f.clientId && !f.dspId)} valueId={dspFolders.activeId} onPick={(f) => saveDspFolder('activeId', f.id, 'active')} />
          <FolderPick label="Inactive / discharged DSPs folder" all={folders.filter((f) => !f.clientId && !f.dspId)} valueId={dspFolders.inactiveId} onPick={(f) => saveDspFolder('inactiveId', f.id, 'inactive')} />
        </Card>
      )}

      <Card>
        <Text style={s.h2}>Agency profile</Text>
        <Field label="Agency name" value={name} onChangeText={setName} />
        <Field label="Primary phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Address" value={address} onChangeText={setAddress} />
        {canEdit && <Btn label="Save changes" onPress={save} />}
        {msg ? <Muted>{msg}</Muted> : null}
      </Card>

      <Card>
        <Text style={s.h2}>My notification preferences</Text>
        {([['push', 'Push alerts (left-site, missed clock-ins, expiries)'], ['emailDigest', 'Weekly summary email']] as const).map(([k, label]) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, gap: 10 }}>
            <Text style={{ flex: 1, color: colors.ink }}>{label}</Text>
            <Btn label={prefs[k] ? 'On' : 'Off'} tone={prefs[k] ? 'primary' : 'ghost'} onPress={() => set({ [k]: !prefs[k] })} />
          </View>
        ))}
      </Card>

      <Card>
        <Text style={s.h2}>Roles & permissions</Text>
        <Muted>These are enforced by the database rules, not just hidden in the app.</Muted>
        {ROLES.map(([role, cells]) => (
          <View key={role} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line, gap: 2 }}>
            <Text style={{ fontWeight: '700', color: colors.ink }}>{role}</Text>
            {cells.map((c, i) => <Text key={i} style={{ color: colors.inkSoft, fontSize: 13 }}>{COLS[i + 1]}: {c}</Text>)}
          </View>
        ))}
      </Card>

      <Card>
        <Text style={s.h2}>Lookup tables</Text>
        <Muted>Service lines used across scheduling, clients and reports.</Muted>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{SERVICE_LINES.map((l) => <Tag key={l} text={l} tone="blue" />)}</View>
      </Card>

      <Btn label="Log out" tone="ghost" onPress={signOutUser} />
    </Screen>
  );
}
