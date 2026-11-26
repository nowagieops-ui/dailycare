import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useShiftsBetween } from '../../lib/admin-data';
import { useAuth } from '../../lib/auth';
import { coverHours, decideCallout, MAX_COVER_HOURS, STATUS_TEXT, STATUS_TONE, useAllCallouts, type Callout } from '../../lib/callouts';
import { colors } from '../../lib/theme';
import { Btn, Card, Chips, Field, fmtDay, fmtTime, Muted, s, Screen, Tag } from '../../lib/ui';
import { addDays, startOfDay } from '../../lib/week';

function Row({ c, shifts }: { c: Callout; shifts: ReturnType<typeof useShiftsBetween> }) {
  const { profile } = useAuth();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const hrs = c.replacementId && c.shiftStart && c.shiftEnd ? coverHours(shifts, c.replacementId, c.shiftStart.toMillis(), c.shiftEnd.toMillis()) : 0;
  const heavy = hrs > MAX_COVER_HOURS;
  const run = async (ok: boolean) => { setBusy(true); try { await decideCallout(c, ok, note, profile); } finally { setBusy(false); } };
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text style={{ fontWeight: '700', color: colors.ink, flex: 1, minWidth: 180 }}>
          {c.staffName} · {c.kind === 'leave' ? `time off ${c.startDate}${c.endDate && c.endDate !== c.startDate ? ` – ${c.endDate}` : ''}` : `call-out ${c.shiftStart ? `${fmtDay(c.shiftStart.toMillis())} ${fmtTime(c.shiftStart.toMillis())}` : ''}`}
        </Text>
        {c.emergency && <Tag text="Emergency" tone="red" />}
        {c.shortNotice && <Tag text="Short notice" tone="amber" />}
        {c.override && <Tag text="Override" tone="blue" />}
        <Tag text={STATUS_TEXT[c.status]} tone={STATUS_TONE[c.status]} />
      </View>
      <Muted>{c.clientName ? `${c.clientName} · ` : ''}{c.reason}</Muted>
      <Muted>Gave about {c.kind === 'leave' ? `${Math.round(c.noticeHours / 24)} days` : `${c.noticeHours} hours`} of notice.</Muted>
      {c.replacementName ? <Muted>Proposed cover: {c.replacementName}{hrs ? ` · would work about ${hrs} hours around this shift${heavy ? ' (more than ' + MAX_COVER_HOURS + ' — check before approving)' : ''}` : ''}</Muted> : null}
      {c.decidedByName ? <Muted>Decided by {c.decidedByName}{c.decisionNote ? `: ${c.decisionNote}` : ''}</Muted> : null}
      {c.status === 'requested' && (
        <>
          <Field label="Note (optional)" value={note} onChangeText={setNote} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Btn label="Deny" tone="danger" busy={busy} onPress={() => run(false)} /></View>
            <View style={{ flex: 1 }}><Btn label={c.shortNotice ? 'Approve (override short notice)' : 'Approve'} busy={busy} onPress={() => run(true)} /></View>
          </View>
        </>
      )}
    </Card>
  );
}

export default function AdminCallouts() {
  const all = useAllCallouts(true);
  const today = useMemo(() => startOfDay(new Date()), []);
  const shifts = useShiftsBetween(addDays(today, -2), addDays(today, 30));
  const [tab, setTab] = useState<string[]>(['pending']);
  const rows = tab[0] === 'pending' ? all.filter((c) => c.status === 'requested') : tab[0] === 'cover' ? all.filter((c) => c.status === 'approved') : all;
  // Policy record per DSP over the last 90 days.
  const since = Date.now() - 90 * 86400000;
  const per = new Map<string, { name: string; callouts: number; emergency: number; short: number; leave: number }>();
  for (const c of all) {
    if ((c.createdAt?.toMillis?.() ?? Date.now()) < since) continue;
    const r = per.get(c.staffId) ?? { name: c.staffName, callouts: 0, emergency: 0, short: 0, leave: 0 };
    if (c.kind === 'leave') r.leave++; else r.callouts++;
    if (c.emergency) r.emergency++;
    if (c.shortNotice) r.short++;
    per.set(c.staffId, r);
  }
  return (
    <Screen title="Call-outs & time off">
      <Muted>A covered or reassigned shift still counts as a call-out for the original DSP. Approve a replacement and they get an alert to accept; the schedule updates when they do.</Muted>
      <Chips options={[{ value: 'pending', label: `Needs a decision (${all.filter((c) => c.status === 'requested').length})` }, { value: 'cover', label: 'Waiting on cover' }, { value: 'all', label: 'All' }, { value: 'record', label: 'Policy record' }]} selected={tab} onToggle={(v) => setTab([v])} />
      {tab[0] === 'record' ? (
        <Card>
          <Text style={s.h2}>Last 90 days</Text>
          {per.size === 0 && <Muted>No call-outs or time off yet.</Muted>}
          {[...per.values()].sort((a, b) => b.callouts - a.callouts).map((r, i) => (
            <View key={r.name + i} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
              <Text style={{ flex: 1, minWidth: 140, fontWeight: '600', color: colors.ink }}>{r.name}</Text>
              <Muted>{r.callouts} call-out{r.callouts === 1 ? '' : 's'} · {r.emergency} emergency · {r.short} short-notice · {r.leave} time off</Muted>
            </View>
          ))}
        </Card>
      ) : (
        <>
          {rows.length === 0 && <Muted>Nothing here.</Muted>}
          {rows.map((c) => <Row key={c.id} c={c} shifts={shifts} />)}
        </>
      )}
    </Screen>
  );
}
