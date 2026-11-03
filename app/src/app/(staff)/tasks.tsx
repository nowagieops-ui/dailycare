import { Linking, Pressable, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { formsForShift, pdfDownloadUrl, submissionFor, useShiftSubmissions, useTemplates } from '../../lib/forms';
import { isShiftTime, pickCurrent, saveTasks, useMyShifts } from '../../lib/shifts';
import { StaffScreen } from '../../lib/staff-ui';
import { colors } from '../../lib/theme';
import { Card, Muted, s, Tag } from '../../lib/ui';

export default function Tasks() {
  const { profile } = useAuth();
  const { shifts } = useMyShifts(profile?.uid);
  const shift = pickCurrent(shifts);
  const templates = useTemplates();
  const forms = shift ? formsForShift(templates, shift) : [];
  const subs = useShiftSubmissions(shift?.id, profile?.uid);

  if (!shift || !isShiftTime(shift)) {
    return (
      <StaffScreen title="Visit Checklist">
        <Muted>{shift ? 'Your checklist appears 15 minutes before the shift starts.' : 'No shift right now.'}</Muted>
      </StaffScreen>
    );
  }
  const done = shift.tasks.filter((t) => t.done).length;
  const locked = shift.status !== 'clocked_in';
  const toggle = (id: string) =>
    !locked && saveTasks(shift.id, shift.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  return (
    <StaffScreen title="Visit Checklist">
      <Card>
        <Text style={s.h2}>{shift.clientName} — {shift.serviceLine}</Text>
        <Muted>{done} of {shift.tasks.length} complete</Muted>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.tint }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.primary, width: `${shift.tasks.length ? (done / shift.tasks.length) * 100 : 0}%` }} />
        </View>
      </Card>
      {locked && <Muted>Clock in to start ticking off tasks.</Muted>}
      <Card>
        {shift.tasks.length === 0 && <Muted>No tasks were set for this visit.</Muted>}
        {shift.tasks.map((t) => (
          <Pressable key={t.id} onPress={() => toggle(t.id)} accessibilityRole="checkbox" accessibilityState={{ checked: t.done, disabled: locked }} style={{ paddingVertical: 10 }}>
            <Text style={{ fontSize: 15, color: t.done ? colors.green : colors.ink, opacity: locked ? 0.5 : 1 }}>
              {t.done ? '☑' : '☐'}  {t.label}
            </Text>
          </Pressable>
        ))}
      </Card>
      {forms.length > 0 && (
        <Card>
          <Text style={s.h2}>Forms for this visit</Text>
          {forms.map((t) => {
            const sub = submissionFor(subs, t.id);
            const failed = subs.find((x) => x.templateId === t.id && x.status === 'failed');
            return (
              <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, flexWrap: 'wrap' }}>
                <Text style={{ flex: 1, minWidth: 160, color: colors.ink, fontWeight: '600' }}>{t.title}{t.required ? ' *' : ''}</Text>
                {sub?.status === 'ready' ? (
                  <Pressable onPress={async () => Linking.openURL(await pdfDownloadUrl(sub.pdfPath!))}><Tag text="PDF ready · open" tone="green" /></Pressable>
                ) : sub ? <Tag text="Submitted · building PDF" tone="blue" /> : (
                  <Pressable disabled={locked} onPress={() => router.push({ pathname: '/form-fill', params: { shiftId: shift.id, templateId: t.id } } as never)}>
                    <Tag text={locked ? 'Clock in first' : failed ? 'Try again' : 'Fill in'} tone={failed ? 'red' : 'amber'} />
                  </Pressable>
                )}
              </View>
            );
          })}
          {forms.some((t) => t.required) && <Muted>* Required before you can clock out.</Muted>}
        </Card>
      )}
      <Link href="/notes" style={{ color: colors.primary, fontWeight: '700' }}>Next: write today's note →</Link>
    </StaffScreen>
  );
}
