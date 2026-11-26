import { useState } from 'react';
import { Text, View } from 'react-native';
import { DateField } from '../../components/DateTimeFields';
import { useAuth } from '../../lib/auth';
import {
  CALLOUT_NOTICE_HOURS, hoursUntil, LEAVE_NOTICE_DAYS, requestCallout, requestLeave, respondToCover, STATUS_TEXT, STATUS_TONE, useCoverRequests, useMyCallouts,
} from '../../lib/callouts';
import { usePeople } from '../../lib/chat';
import { useMyShifts } from '../../lib/shifts';
import { StaffScreen } from '../../lib/staff-ui';
import { colors } from '../../lib/theme';
import { Btn, Card, Chips, Field, fmtDay, fmtTime, Muted, s, Tag } from '../../lib/ui';

/** Call out of a shift, ask for time off, answer cover requests, and see your own attendance history. */
export default function Callouts() {
  const { profile } = useAuth();
  const { shifts } = useMyShifts(profile?.uid, 0);
  const mine = useMyCallouts(profile?.uid);
  const cover = useCoverRequests(profile?.uid).filter((c) => c.status === 'approved');
  const people = usePeople().filter((p) => p.id !== profile?.uid && (p.role === 'staff' || p.role === 'family_staff'));
  const [tab, setTab] = useState<string[]>(['callout']);
  const [shiftId, setShiftId] = useState<string[]>([]);
  const [emergency, setEmergency] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [rep, setRep] = useState<string[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!profile) return null;

  const upcoming = shifts.filter((x) => x.status === 'scheduled' && x.start.toMillis() > Date.now());
  const shift = upcoming.find((x) => x.id === shiftId[0]);
  const hrs = shift ? hoursUntil(shift.start.toMillis()) : 0;
  const short = !!shift && hrs < CALLOUT_NOTICE_HOURS;
  const isEmergency = emergency.length > 0 || short; // under 48 hours can only go through the emergency route
  const repPerson = people.find((p) => p.id === rep[0]);

  async function sendCallout() {
    if (!shift) return;
    setBusy(true); setMsg('');
    try {
      await requestCallout(profile!, shift, reason, isEmergency, repPerson ? { id: repPerson.id, name: repPerson.name } : undefined);
      setShiftId([]); setReason(''); setRep([]); setEmergency([]);
      setMsg('Sent. Your coordinator will review it. A call-out stays on your record even if someone covers the shift.');
    } finally { setBusy(false); }
  }
  async function sendLeave() {
    setBusy(true); setMsg('');
    try { await requestLeave(profile!, from, to || from, reason); setFrom(''); setTo(''); setReason(''); setMsg('Time-off request sent.'); }
    finally { setBusy(false); }
  }
  const leaveDays = from ? (new Date(from + 'T00:00:00').getTime() - Date.now()) / 86400000 : 99;

  return (
    <StaffScreen title="Call-outs & Time Off">
      {cover.length > 0 && (
        <Card style={{ borderColor: colors.primary }}>
          <Text style={s.h2}>Can you cover a shift?</Text>
          {cover.map((c) => (
            <View key={c.id} style={{ gap: 6 }}>
              <Text style={{ color: colors.ink, fontWeight: '600' }}>{c.shiftStart ? `${fmtDay(c.shiftStart.toMillis())}, ${fmtTime(c.shiftStart.toMillis())} – ${c.shiftEnd ? fmtTime(c.shiftEnd.toMillis()) : ''}` : 'A shift'}</Text>
              <Muted>Asked by {c.staffName}. Your coordinator has approved it. If you accept, the shift moves to your schedule.</Muted>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><Btn label="Decline" tone="ghost" onPress={() => respondToCover(c.id, false)} /></View>
                <View style={{ flex: 1 }}><Btn label="Accept" onPress={() => respondToCover(c.id, true)} /></View>
              </View>
            </View>
          ))}
        </Card>
      )}

      <Chips options={[{ value: 'callout', label: 'Call out of a shift' }, { value: 'leave', label: 'Request time off' }, { value: 'history', label: `My history (${mine.length})` }]} selected={tab} onToggle={(v) => { setTab([v]); setMsg(''); }} />
      {msg ? <Text style={{ color: colors.green }}>{msg}</Text> : null}

      {tab[0] === 'callout' && (
        <Card>
          <Text style={s.h2}>Call out of a shift</Text>
          <Muted>Regular call-outs need at least {CALLOUT_NOTICE_HOURS} hours' notice. Closer than that, it goes through the emergency route and is flagged for review.</Muted>
          {upcoming.length === 0 && <Muted>You have no upcoming shifts.</Muted>}
          <Chips options={upcoming.map((x) => ({ value: x.id, label: `${fmtDay(x.start.toMillis())} ${fmtTime(x.start.toMillis())} · ${x.clientName}` }))} selected={shiftId} onToggle={(v) => setShiftId([v])} />
          {shift && (
            <>
              {short
                ? <Text style={{ color: colors.amber, fontWeight: '600' }}>This shift is in {Math.max(0, Math.round(hrs))} hours, so it is an emergency call-out and will be flagged as short notice.</Text>
                : <Chips options={[{ value: 'e', label: 'This is an emergency' }]} selected={emergency} onToggle={() => setEmergency((e) => (e.length ? [] : ['e']))} />}
              <Field label={isEmergency ? 'What happened? (required)' : 'Reason (required)'} value={reason} onChangeText={setReason} multiline />
              <Text style={{ fontWeight: '600' }}>Someone to cover (optional)</Text>
              <Muted>Your coordinator must approve the cover, and that person must accept. This still counts as a call-out for you.</Muted>
              <Chips options={people.map((p) => ({ value: p.id, label: p.name }))} selected={rep} onToggle={(v) => setRep((r) => (r[0] === v ? [] : [v]))} />
              <Btn label={isEmergency ? 'Send emergency call-out' : 'Send call-out'} busy={busy} tone={isEmergency ? 'danger' : 'primary'} disabled={reason.trim().length < 5} onPress={sendCallout} />
            </>
          )}
        </Card>
      )}

      {tab[0] === 'leave' && (
        <Card>
          <Text style={s.h2}>Request time off</Text>
          <Muted>Planned time off needs at least {LEAVE_NOTICE_DAYS} days' notice. Closer than that is flagged for management.</Muted>
          <DateField label="First day off" value={from} onChange={setFrom} />
          <DateField label="Last day off" value={to} onChange={setTo} optional />
          {from && leaveDays < LEAVE_NOTICE_DAYS ? <Text style={{ color: colors.amber, fontWeight: '600' }}>Less than {LEAVE_NOTICE_DAYS} days' notice. It will be flagged and needs a manager's override.</Text> : null}
          <Field label="Reason (required)" value={reason} onChangeText={setReason} multiline />
          <Btn label="Send request" busy={busy} disabled={!from || reason.trim().length < 5} onPress={sendLeave} />
        </Card>
      )}

      {tab[0] === 'history' && (
        <>
          <Muted>Your call-outs and time off, as management sees them. If something is wrong, tell your coordinator.</Muted>
          {mine.length === 0 && <Muted>Nothing yet.</Muted>}
          {mine.map((c) => (
            <Card key={c.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <Text style={{ fontWeight: '700', color: colors.ink }}>
                  {c.kind === 'leave' ? `Time off ${c.startDate}${c.endDate && c.endDate !== c.startDate ? ` – ${c.endDate}` : ''}` : `Call-out ${c.shiftStart ? fmtDay(c.shiftStart.toMillis()) : ''}`}
                </Text>
                <Tag text={STATUS_TEXT[c.status]} tone={STATUS_TONE[c.status]} />
              </View>
              <Muted>{c.emergency ? 'Emergency · ' : ''}{c.shortNotice ? 'Short notice · ' : ''}{c.reason}</Muted>
              {c.replacementName ? <Muted>Cover: {c.replacementName}</Muted> : null}
              {c.decisionNote ? <Muted>Note from {c.decidedByName}: {c.decisionNote}</Muted> : null}
            </Card>
          ))}
        </>
      )}
    </StaffScreen>
  );
}
