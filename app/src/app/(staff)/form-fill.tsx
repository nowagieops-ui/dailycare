import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { DateField } from '../../components/DateTimeFields';
import { useAuth } from '../../lib/auth';
import { initialValues, submitForm, useTemplates, type Answer, type FormField } from '../../lib/forms';
import { useMyShifts } from '../../lib/shifts';
import { StaffScreen } from '../../lib/staff-ui';
import { colors } from '../../lib/theme';
import { Btn, Card, Field, Muted, s } from '../../lib/ui';

const isEmpty = (f: FormField, v: Answer | undefined) =>
  f.type === 'checkbox' ? v !== true : f.type === 'signature' ? !(typeof v === 'object' && v.typed.trim().length > 1) : String(v ?? '').trim() === '';

/** One form for one visit. The layout is generated from the template's field list. */
export default function FormFill() {
  const { shiftId, templateId } = useLocalSearchParams<{ shiftId: string; templateId: string }>();
  const { profile } = useAuth();
  const { shifts } = useMyShifts(profile?.uid, 24 * 3);
  const shift = shifts.find((x) => x.id === shiftId);
  const template = useTemplates().find((t) => t.id === templateId);
  const [values, setValues] = useState<Record<string, Answer> | null>(null);
  const [step, setStep] = useState<'fill' | 'review'>('fill');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const v = useMemo(() => values ?? (template && shift && profile ? initialValues(template, { staffName: profile.name, shift }) : null), [values, template, shift, profile]);
  if (!template || !shift || !profile || !v) return <StaffScreen title="Form"><Muted>Loading…</Muted></StaffScreen>;

  const set = (key: string, val: Answer) => setValues({ ...v, [key]: val });
  const missing = template.fields.filter((f) => f.required && !f.prefill && isEmpty(f, v[f.key]));
  const back = <Pressable onPress={() => router.replace('/tasks' as never)}><Text style={{ color: colors.primary, fontWeight: '700' }}>← Visit Checklist</Text></Pressable>;

  async function submit() {
    setBusy(true); setErr('');
    try { await submitForm(template!, shift!, profile!.uid, v!); router.replace('/tasks' as never); }
    catch { setErr('Could not submit. Check your connection and try again.'); }
    finally { setBusy(false); }
  }

  const input = (f: FormField) => {
    const val = v[f.key];
    if (f.prefill) return <Field label={f.label} value={String(val)} editable={false} />;
    if (f.type === 'checkbox') {
      return (
        <Pressable onPress={() => set(f.key, !val)} accessibilityRole="checkbox" accessibilityState={{ checked: val === true }} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 4 }}>
          <Text style={{ fontSize: 20, color: val === true ? colors.primary : colors.inkFaint }}>{val === true ? '☑' : '☐'}</Text>
          <Text style={{ flex: 1, color: colors.ink }}>{f.label}{f.required ? ' *' : ''}</Text>
        </Pressable>
      );
    }
    if (f.type === 'select') {
      return (
        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: '600', color: colors.inkSoft, fontSize: 13 }}>{f.label}{f.required ? ' *' : ''}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(f.options ?? []).map((o) => (
              <Pressable key={o} onPress={() => set(f.key, o)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: val === o ? colors.primary : colors.line, backgroundColor: val === o ? colors.tint : colors.paper }}>
                <Text style={{ color: val === o ? colors.primary : colors.inkSoft, fontWeight: '600' }}>{o}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }
    if (f.type === 'date') {
      // Stored as readable text ("November 3, 2026") because that is what is written into the PDF.
      const d = new Date(String(val));
      const iso = isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return <DateField label={`${f.label}${f.required ? ' *' : ''}`} value={iso}
        onChange={(v) => set(f.key, v ? new Date(`${v}T12:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '')} />;
    }
    if (f.type === 'signature') {
      const typed = typeof val === 'object' ? val.typed : '';
      return (
        <View style={{ gap: 4 }}>
          <Field label={`${f.label} — type your full name to sign${f.required ? ' *' : ''}`} value={typed} onChangeText={(t) => set(f.key, { typed: t })} />
          {typed.trim().length > 1 && <Text style={{ fontSize: 22, fontStyle: 'italic', color: colors.navy }}>{typed}</Text>}
        </View>
      );
    }
    return (
      <View style={{ gap: 4 }}>
        <Text style={{ fontWeight: '600', color: colors.inkSoft, fontSize: 13 }}>{f.label}{f.required ? ' *' : ''}</Text>
        <TextInput
          value={String(val ?? '')} onChangeText={(t) => set(f.key, t)} multiline={f.type === 'multiline'} maxLength={5000}
          style={[s.input, f.type === 'multiline' && { minHeight: 110, paddingTop: 10, textAlignVertical: 'top' }]}
          placeholderTextColor={colors.inkFaint}
        />
      </View>
    );
  };

  if (step === 'review') {
    return (
      <StaffScreen title="Review & Submit">
        {back}
        <Muted>Check your answers. They will be written into the PDF exactly as shown.</Muted>
        <Card>
          <Text style={s.h2}>{template.title}</Text>
          {template.fields.map((f) => {
            const val = v[f.key];
            const shown = f.type === 'checkbox' ? (val === true ? 'Yes' : 'No') : typeof val === 'object' ? val.typed : String(val ?? '');
            return <View key={f.key} style={{ paddingVertical: 4 }}><Text style={{ color: colors.inkFaint, fontSize: 12 }}>{f.label}</Text><Text style={{ color: colors.ink }}>{shown || '—'}</Text></View>;
          })}
        </Card>
        {err ? <Text style={{ color: colors.red }}>{err}</Text> : null}
        <Btn label="Submit form" onPress={submit} busy={busy} />
        <Btn label="Back" tone="ghost" onPress={() => setStep('fill')} />
      </StaffScreen>
    );
  }

  return (
    <StaffScreen title={template.title}>
      {back}
      <Muted>{shift.clientName} — {shift.serviceLine}. Fields marked * are required.</Muted>
      <Card>{template.fields.map((f) => <View key={f.key}>{input(f)}</View>)}</Card>
      {missing.length > 0 && <Muted>Still needed: {missing.slice(0, 4).map((f) => f.label).join(', ')}{missing.length > 4 ? '…' : ''}</Muted>}
      <Btn label="Review" onPress={() => setStep('review')} disabled={missing.length > 0} />
    </StaffScreen>
  );
}
