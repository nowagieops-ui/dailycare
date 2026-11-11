import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { addDoc, collection, deleteDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { deleteObject, ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { BoxMapper } from '../../components/BoxMapper';
import type { Box } from '../../components/box-types';
import { useClients } from '../../lib/admin-data';
import { db, functions, storage } from '../../lib/firebase';
import { FieldType, FormField, FormTemplate, Prefill, PREFILL_LABEL } from '../../lib/forms';
import { colors } from '../../lib/theme';
import { SERVICE_LINES } from '../../lib/types';
import { Btn, Card, Chips, Field, Muted, s, Screen } from '../../lib/ui';

type Detected = { pages: { width: number; height: number }[]; fields: { name: string; type: FieldType | 'signature'; options?: string[] }[]; fillable: boolean };
const TYPES: FieldType[] = ['text', 'multiline', 'date', 'checkbox', 'select', 'signature'];
const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'field';
const pretty = (x: string) => x.replace(/[_\-.]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());
const MAX = 25 * 1024 * 1024;

/** Create a form from a PDF (fillable fields are found automatically; flat PDFs get boxes drawn on them), or edit one. */
export default function FormEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const clients = useClients();
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [required, setRequired] = useState(false);
  const [pdf, setPdf] = useState<{ name: string; data: ArrayBuffer } | null>(null);
  const [detected, setDetected] = useState<Detected | null>(null);
  const [existing, setExisting] = useState<FormTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'formTemplates', id)).then((x) => {
      const t = x.data() as FormTemplate | undefined;
      if (!t) return;
      setExisting({ ...t, id }); setTitle(t.title); setFields(t.fields); setLines(t.serviceLines); setClientIds(t.clientIds); setRequired(t.required);
    });
  }, [id]);

  async function pickPdf() {
    setErr('');
    let name = '', data: ArrayBuffer | null = null;
    if (Platform.OS === 'web') {
      const f: File | undefined = await new Promise((res) => {
        const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/pdf';
        i.onchange = () => res(i.files?.[0]); i.click();
      });
      if (!f) return;
      if (f.type !== 'application/pdf' || f.size >= MAX) return setErr('Choose a PDF under 25 MB.');
      name = f.name; data = await f.arrayBuffer();
    } else {
      const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      const a = r.assets?.[0];
      if (r.canceled || !a) return;
      if ((a.size ?? 0) >= MAX) return setErr('Choose a PDF under 25 MB.');
      name = a.name; data = await (await (await fetch(a.uri)).blob()).arrayBuffer();
    }
    setPdf({ name, data });
    if (!title) setTitle(pretty(name.replace(/\.pdf$/i, '')));
    setBusy(true);
    try {
      // Upload first (to a draft id), then ask the server what is inside.
      const tplId = existing?.id ?? draftId;
      const path = `formTemplates/${tplId}/template.pdf`;
      await uploadBytes(ref(storage, path), new Uint8Array(data), { contentType: 'application/pdf' });
      const { data: d } = await httpsCallable<{ path: string }, Detected>(functions, 'inspectTemplate')({ path });
      setDetected(d);
      const used = new Set<string>();
      const auto: FormField[] = d.fields.filter((f) => f.type !== 'signature').map((f) => {
        let key = slug(f.name), n = 2;
        while (used.has(key)) key = `${slug(f.name)}_${n++}`;
        used.add(key);
        return { key, label: pretty(f.name), type: f.type as FieldType, required: false, ...(f.options ? { options: f.options } : {}), target: { kind: 'acro' as const, name: f.name } };
      });
      setFields(auto);
    } catch (e: any) { setErr(e?.message?.replace(/^.*?: /, '') || 'Could not read this PDF.'); }
    finally { setBusy(false); }
  }

  const [draftId] = useState(() => doc(collection(db, 'formTemplates')).id);
  const tplId = existing?.id ?? draftId;
  const patch = (key: string, p: Partial<FormField>) => setFields((c) => c.map((f) => (f.key === key ? { ...f, ...p } : f)));
  const boxes: Box[] = fields.flatMap((f, i) => (f.target.kind === 'box' ? [{ id: f.key, label: f.label, page: f.target.page, x: f.target.x, y: f.target.y, w: f.target.w, h: f.target.h }] : []))
    .map((b) => ({ ...b, n: fields.findIndex((f) => f.key === b.id) + 1 }));

  function addBox(b: Omit<Box, 'id'>) {
    let n = fields.length + 1;
    while (fields.some((f) => f.key === `field_${n}`)) n++;
    setFields((c) => [...c, { key: `field_${n}`, label: `Field ${n}`, type: 'text', required: false, target: { kind: 'box', page: b.page, x: b.x, y: b.y, w: b.w, h: b.h, fontSize: 10 } }]);
  }

  const ok = title.trim() && fields.length > 0 && (existing || pdf) && fields.every((f) => f.label.trim() && (f.type !== 'select' || (f.options?.length ?? 0) > 0));

  async function save() {
    setBusy(true); setErr('');
    try {
      const data = {
        title: title.trim(), fields, serviceLines: lines, clientIds, required, active: existing?.active ?? true,
        pdfPath: `formTemplates/${tplId}/template.pdf`, pages: detected?.pages ?? existing?.pages ?? [],
      };
      await setDoc(doc(db, 'formTemplates', tplId), existing ? data : { ...data, createdAt: serverTimestamp() }, { merge: true });
      router.replace('/admin/forms' as never);
    } catch { setErr('Could not save the form.'); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!existing) return;
    setBusy(true);
    try { await deleteDoc(doc(db, 'formTemplates', existing.id)); await deleteObject(ref(storage, existing.pdfPath)).catch(() => {}); router.replace('/admin/forms' as never); }
    finally { setBusy(false); }
  }

  const flat = pdf && detected && !detected.fillable;
  return (
    <Screen title="PDF Form">
      <Card>
        <Field label="Form name" value={title} onChangeText={setTitle} />
        {!existing && <Btn label={pdf ? `PDF: ${pdf.name} (tap to change)` : 'Choose the PDF'} tone="ghost" onPress={pickPdf} busy={busy} />}
        {existing && <Muted>To change the PDF itself, create a new form from the new PDF and turn this one off.</Muted>}
        {detected && <Muted>{detected.fillable ? `Fillable PDF: found ${fields.length} field${fields.length === 1 ? '' : 's'} automatically. Rename or remove any below.` : 'This PDF has no fillable fields. Drag boxes on the pages below where answers should be written.'}</Muted>}
      </Card>

      {flat && pdf && <Card><BoxMapper data={pdf.data} boxes={boxes} onAdd={addBox} /></Card>}

      <Card>
        <Text style={s.h2}>Fields ({fields.length})</Text>
        {fields.length === 0 && <Muted>{pdf ? 'No fields yet.' : 'Choose a PDF to begin.'}</Muted>}
        {fields.map((f, i) => (
          <View key={f.key} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, paddingTop: i ? 10 : 0, gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Text style={{ width: 22, color: colors.inkFaint }}>{i + 1}</Text>
              <TextInput value={f.label} onChangeText={(t) => patch(f.key, { label: t })} style={[s.input, { flex: 1 }]} placeholder="Question shown to staff" placeholderTextColor={colors.inkFaint} />
              <Pressable onPress={() => setFields((c) => c.filter((x) => x.key !== f.key))}><Text style={{ color: colors.red, fontWeight: '700' }}>Remove</Text></Pressable>
            </View>
            {f.target.kind === 'box' && <Chips<FieldType> options={TYPES.map((t) => ({ value: t, label: t }))} selected={[f.type]} onToggle={(t) => patch(f.key, { type: t })} />}
            {f.target.kind === 'acro' && <Muted>Type: {f.type} (from the PDF)</Muted>}
            {f.type === 'select' && f.target.kind === 'box' && <Field label="Choices (comma separated)" value={(f.options ?? []).join(', ')} onChangeText={(t) => patch(f.key, { options: t.split(',').map((x) => x.trim()).filter(Boolean) })} />}
            {(f.type === 'text' || f.type === 'date') && (
              <Chips<Prefill> options={(Object.keys(PREFILL_LABEL) as Prefill[]).map((p) => ({ value: p, label: `Auto: ${PREFILL_LABEL[p]}` }))} selected={f.prefill ? [f.prefill] : []} onToggle={(p) => patch(f.key, { prefill: f.prefill === p ? undefined : p })} />
            )}
            <Chips options={[{ value: 'req', label: 'Required' }]} selected={f.required ? ['req'] : []} onToggle={() => patch(f.key, { required: !f.required })} />
          </View>
        ))}
      </Card>

      <Card>
        <Text style={s.h2}>Where it appears</Text>
        <Muted>Leave all empty to show it on every visit.</Muted>
        <Chips options={SERVICE_LINES.map((l) => ({ value: l as string, label: l }))} selected={lines} onToggle={(v) => setLines((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]))} />
        <Chips options={clients.map((c) => ({ value: c.id, label: c.name }))} selected={clientIds} onToggle={(v) => setClientIds((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]))} />
        <Chips options={[{ value: 'req', label: 'Staff must complete it before clocking out' }]} selected={required ? ['req'] : []} onToggle={() => setRequired((r) => !r)} />
      </Card>

      {err ? <Text style={{ color: colors.red }}>{err}</Text> : null}
      <Btn label={existing ? 'Save changes' : 'Create form'} onPress={save} busy={busy} disabled={!ok} />
      {existing && <Btn label="Delete form" tone="danger" onPress={remove} busy={busy} />}
    </Screen>
  );
}
