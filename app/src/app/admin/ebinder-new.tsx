import { useEffect, useState } from 'react';
import { Platform, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useClients, useStaff } from '../../lib/admin-data';
import { useAuth } from '../../lib/auth';
import { attachPdf, Audience, audienceLabel, FOLDERS, logEvent, type EDoc, type Folder } from '../../lib/ebinder';
import { mirrorEbinderDoc } from '../../lib/drive';
import { db } from '../../lib/firebase';
import { Btn, Card, Chips, Field, Muted, s, Screen } from '../../lib/ui';

/** New document, or (with ?id=) a new version of an existing one. */
export default function EBinderNew() {
  const { id, clientId: presetClient } = useLocalSearchParams<{ id?: string; clientId?: string }>();
  const { profile } = useAuth();
  const staff = useStaff().filter((u) => (u.role === 'staff' || u.role === 'family_staff') && u.active);
  const clients = useClients();
  const [clientId, setClientId] = useState<string[]>(presetClient ? [String(presetClient)] : []);
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState<Folder[]>(['HR & Personnel']);
  const [audience, setAudience] = useState<Audience[]>(['all_staff']);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [sign, setSign] = useState<string[]>(['yes']);
  const [body, setBody] = useState('');
  const [acks, setAcks] = useState('');
  const [version, setVersion] = useState(0);
  const [pdf, setPdf] = useState<{ name: string; blob: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'ebinderDocs', id)).then((x) => {
      const d = x.data() as EDoc | undefined;
      if (!d) return;
      setTitle(d.title); setClientId(d.clientId ? [d.clientId] : []); setFolder([d.folder]); setAudience([d.audience]); setAssigned(d.assignedTo);
      setSign([d.requiresSignature ? 'yes' : 'no']); setBody(d.body); setAcks(d.acks.join('\n')); setVersion(d.version);
    });
  }, [id]);

  const ok = title.trim() && (body.trim() || pdf) && (audience[0] !== 'assigned' || assigned.length > 0);

  async function pickPdf() {
    setErr('');
    const MAX = 25 * 1024 * 1024;
    if (Platform.OS === 'web') {
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/pdf';
      i.onchange = () => {
        const f = i.files?.[0];
        if (f && f.size < MAX && f.type === 'application/pdf') setPdf({ name: f.name, blob: f });
        else if (f) setErr('Choose a PDF under 25 MB.');
      };
      i.click();
      return;
    }
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    const a = r.assets?.[0];
    if (r.canceled || !a) return;
    if ((a.size ?? 0) >= MAX) return setErr('Choose a PDF under 25 MB.');
    setPdf({ name: a.name, blob: await (await fetch(a.uri)).blob() });
  }

  async function save() {
    if (!profile) return;
    setBusy(true); setErr('');
    try {
      const data = {
        title: title.trim(), folder: folder[0], clientId: clientId[0] ?? '', audience: audience[0], assignedTo: audience[0] === 'assigned' ? assigned : [],
        requiresSignature: sign[0] === 'yes' && audience[0] !== 'admin', body: body.trim(),
        acks: acks.split('\n').map((a) => a.trim()).filter(Boolean), uploadedByName: profile.name, updatedAt: serverTimestamp(),
        ...(pdf ? { fileName: pdf.name } : {}),
      };
      let docId = id;
      if (id) { await updateDoc(doc(db, 'ebinderDocs', id), { ...data, version: version + 1 }); }
      else { docId = (await addDoc(collection(db, 'ebinderDocs'), { ...data, version: 1 })).id; }
      const v = id ? version + 1 : 1;
      if (pdf) await updateDoc(doc(db, 'ebinderDocs', docId!), { pdfPath: await attachPdf(docId!, v, pdf.blob) });
      const client = clients.find((c) => c.id === clientId[0]);
      if (pdf && client) await mirrorEbinderDoc(docId!, pdf.name, folder[0], client, profile.uid, profile.name, pdf.blob.size).catch(() => {});
      await logEvent(docId!, profile, `${profile.name} uploaded v${v}`);
      router.replace({ pathname: '/admin/document-detail', params: { id: docId } } as never);
    } catch { setErr('Could not save the document.'); }
    finally { setBusy(false); }
  }

  return (
    <Screen title="Upload document">
      <Card>
        <Text style={s.h2}>{id ? `New version (v${version + 1})` : 'Document details'}</Text>
        <Field label="Title" value={title} onChangeText={setTitle} />
        <Text style={{ fontWeight: '600' }}>Folder</Text>
        <Chips<Folder> options={[...FOLDERS, ...(FOLDERS.includes(folder[0] as never) ? [] : [folder[0]])].map((f) => ({ value: f, label: f }))} selected={folder} onToggle={(v) => setFolder([v])} />
        <Text style={{ fontWeight: '600' }}>Client this belongs to (optional)</Text>
        <Chips options={clients.map((c) => ({ value: c.id, label: c.name }))} selected={clientId} onToggle={(v) => setClientId((c) => (c[0] === v ? [] : [v]))} />
        {clientId[0] ? <Muted>It will also appear in this client's folder in the file manager.</Muted> : null}
        <Text style={{ fontWeight: '600' }}>Who can see it</Text>
        <Chips<Audience> options={(Object.keys(audienceLabel) as Audience[]).map((a) => ({ value: a, label: audienceLabel[a] }))} selected={audience} onToggle={(v) => setAudience([v])} />
        {audience[0] === 'assigned' && (
          <Chips options={staff.map((u) => ({ value: u.id, label: u.name }))} selected={assigned}
            onToggle={(v) => setAssigned((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]))} />
        )}
        {audience[0] !== 'admin' && (
          <>
            <Text style={{ fontWeight: '600' }}>DSPs must sign it</Text>
            <Chips options={[{ value: 'yes', label: 'Yes, e-signature' }, { value: 'no', label: 'No, view only' }]} selected={sign} onToggle={(v) => setSign([v])} />
          </>
        )}
        <Btn label={pdf ? `PDF: ${pdf.name}` : 'Attach a PDF (optional)'} tone="ghost" onPress={pickPdf} />
        <Muted>With a PDF attached, DSPs open the PDF and the text below is the acknowledgment shown beside it.</Muted>
        <Field label="Document text" value={body} onChangeText={setBody} multiline numberOfLines={8} style={[s.input, { minHeight: 160, paddingTop: 10 }]}
          placeholder="I, {{name}}, acknowledge that on {{date}} I received…" />
        <Muted>{'{{name}} and {{date}} are filled in with the signer\'s printed name and the signing date.'}</Muted>
        {sign[0] === 'yes' && <Field label="Acknowledgment lines (one per line, each must be ticked)" value={acks} onChangeText={setAcks} multiline numberOfLines={4} style={[s.input, { minHeight: 90, paddingTop: 10 }]} />}
        {err ? <Text style={{ color: '#C1554B' }}>{err}</Text> : null}
        <Btn label={id ? 'Publish new version' : 'Create document'} onPress={save} busy={busy} disabled={!ok} />
      </Card>
    </Screen>
  );
}
