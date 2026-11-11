import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../lib/auth';
import { logEvent, pdfUrl, renderBody, signDocument, useSignedIds, type EDoc } from '../../lib/ebinder';
import { db } from '../../lib/firebase';
import { StaffScreen } from '../../lib/staff-ui';
import { colors } from '../../lib/theme';
import { Btn, Card, Eyebrow, Field, Muted, s } from '../../lib/ui';

/** Fill -> preview -> e-sign, for one eBinder document (mockup: Fill Document + Review & Sign). */
export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [d, setD] = useState<EDoc | null>(null);
  const [agency, setAgency] = useState('Daily Care Support Services');
  const [step, setStep] = useState<'fill' | 'preview'>('fill');
  const [name, setName] = useState('');
  const [ticked, setTicked] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const viewed = useRef(false);

  useEffect(() => onSnapshot(doc(db, 'ebinderDocs', String(id)), (x) => setD(x.exists() ? ({ ...(x.data() as EDoc), id: x.id }) : null), () => {}), [id]);
  useEffect(() => onSnapshot(doc(db, 'settings', 'agency'), (x) => { if (x.data()?.name) setAgency(x.data()!.name); }, () => {}), []);
  useEffect(() => { if (profile && !name) setName(profile.name); }, [profile?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (d) setTicked(d.acks.map(() => false)); }, [d?.id, d?.version]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (d && profile && !viewed.current) { viewed.current = true; logEvent(d.id, profile, `${profile.name} viewed document`).catch(() => {}); }
  }, [d?.id, profile?.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  const signed = useSignedIds(d ? [d] : [], profile?.uid)[d?.id ?? ''];

  if (!d || !profile) return <StaffScreen title="Document"><Muted>Loading…</Muted></StaffScreen>;
  const today = new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
  const paper = (
    <Card>
      <Muted>{agency}</Muted>
      <Text style={s.h1}>{d.title}</Text>
      {d.body ? <Text style={{ color: colors.ink, lineHeight: 22 }}>{renderBody(d.body, name, today)}</Text> : null}
      {d.pdfPath ? <Btn label="Open PDF" tone="ghost" onPress={async () => Linking.openURL(await pdfUrl(d.pdfPath!))} /> : null}
    </Card>
  );

  // Care plans and policies without a signature are view-only.
  if (!d.requiresSignature) return <StaffScreen title={d.title}><Muted>View only · v{d.version}</Muted>{paper}</StaffScreen>;
  if (signed) return <StaffScreen title={d.title}><Muted>You signed this document.</Muted>{paper}</StaffScreen>;

  const ready = name.trim().length > 1 && ticked.every(Boolean);

  async function submit() {
    setBusy(true); setErr('');
    try { await signDocument(d!, profile!, name.trim(), today); router.replace('/documents' as never); }
    catch { setErr('Could not submit. Check your connection and try again.'); }
    finally { setBusy(false); }
  }

  if (step === 'fill') {
    return (
      <StaffScreen title="Fill Document">
        
        <Eyebrow>{d.folder}</Eyebrow>
        <Text style={s.h1}>{d.title}</Text>
        <Muted>Fill in the fields below. You'll see the finished document before it's submitted to your compliance file.</Muted>
        <Card>
          <Field label="Employee printed name" value={name} onChangeText={setName} />
          <Field label="Date" value={today} editable={false} />
          {d.acks.length > 0 && <Text style={{ fontWeight: '700', color: colors.ink }}>Acknowledgment</Text>}
          {d.acks.map((a, i) => (
            <Pressable key={i} onPress={() => setTicked((t) => t.map((v, j) => (j === i ? !v : v)))} accessibilityRole="checkbox" accessibilityState={{ checked: ticked[i] }}
              style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 4 }}>
              <Text style={{ fontSize: 20, color: ticked[i] ? colors.primary : colors.inkFaint }}>{ticked[i] ? '☑' : '☐'}</Text>
              <Text style={{ flex: 1, color: colors.ink }}>{a}</Text>
            </Pressable>
          ))}
        </Card>
        <Btn label="Preview & Sign" onPress={() => setStep('preview')} disabled={!ready} />
      </StaffScreen>
    );
  }

  return (
    <StaffScreen title="Review & Sign">
      <Muted>Document preview — this is exactly what gets filed</Muted>
      {paper}
      <Card>
        {d.acks.map((a, i) => <Text key={i} style={{ color: colors.ink }}>☑ {a}</Text>)}
        <Text style={{ fontSize: 22, fontStyle: 'italic', color: colors.navy, paddingTop: 8 }}>{name}</Text>
        <Muted>Signed electronically by {name} on {today}</Muted>
      </Card>
      {err ? <Text style={{ color: colors.red }}>{err}</Text> : null}
      <Btn label="Submit Signed Document" onPress={submit} busy={busy} />
      <Btn label="Back" tone="ghost" onPress={() => setStep('fill')} />
      <Muted>This document will be securely filed in your compliance record.</Muted>
    </StaffScreen>
  );
}
