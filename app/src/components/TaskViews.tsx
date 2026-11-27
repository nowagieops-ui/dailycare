import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { DateField, TimeField } from './DateTimeFields';
import { useAuth } from '../lib/auth';
import { usePeople } from '../lib/chat';
import {
  attachmentUrl, createTask, decideExtension, dueOf, isOverdue, monthlyScores, requestExtension, signOff, STATUS_TEXT, submitTask, useAdminTasks, wasLate, type AdminTask, type Pick,
} from '../lib/adminTasks';
import { colors } from '../lib/theme';
import { Btn, Card, Chips, Field, fmtDay, fmtTime, Muted, s, Tag } from '../lib/ui';

const when = (ms: number) => `${fmtDay(ms)} ${fmtTime(ms)}`;
const at = (d: string, t: string) => new Date(`${d}T${t || '17:00'}:00`).getTime();

function TaskCard({ t }: { t: AdminTask }) {
  const { profile } = useAuth();
  const [resp, setResp] = useState('');
  const [ext, setExt] = useState(false);
  const [reason, setReason] = useState('');
  const [progress, setProgress] = useState('');
  const [d, setD] = useState('');
  const [tm, setTm] = useState('17:00');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<Pick[]>([]);
  const [err, setErr] = useState('');
  if (!profile) return null;
  async function addFile() {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    if ((a.size ?? 0) > 25 * 1024 * 1024) return setErr('That file is over 25 MB.');
    setErr('');
    setFiles((f) => [...f, { name: a.name, type: a.mimeType ?? 'application/octet-stream', blob: a.file ?? (null as never) }]);
    if (!a.file) { const b = await (await fetch(a.uri)).blob(); setFiles((f) => f.map((x) => (x.name === a.name && !x.blob ? { ...x, blob: b } : x))); }
  }
  const mine = t.assigneeId === profile.uid;
  const boss = t.assignerId === profile.uid || profile.role === 'super_admin';
  const over = isOverdue(t);
  const run = async (f: () => Promise<unknown>) => { setBusy(true); try { await f(); } finally { setBusy(false); } };
  return (
    <Card style={over ? { borderColor: colors.red } : undefined}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text style={{ fontWeight: '700', color: colors.ink, flex: 1, minWidth: 180 }}>{t.title}</Text>
        {over && <Tag text="Overdue" tone="red" />}
        {t.extension?.status === 'approved' && <Tag text="Extended" tone="blue" />}
        <Tag text={STATUS_TEXT[t.status]} tone={t.status === 'signed_off' ? 'green' : t.status === 'submitted' ? 'blue' : over ? 'red' : 'amber'} />
      </View>
      <Muted>For {t.assigneeName} · from {t.assignerName} · due {when(dueOf(t))}</Muted>
      {t.details ? <Text style={{ color: colors.ink }}>{t.details}</Text> : null}
      {t.response ? (
        <View style={{ backgroundColor: colors.tint, borderRadius: 10, padding: 10, gap: 2 }}>
          <Text style={{ fontWeight: '600', color: colors.ink }}>Response{t.responseAt ? ` · ${when(t.responseAt)}${wasLate(t) ? ' · late' : ''}` : ''}</Text>
          <Text style={{ color: colors.ink }}>{t.response}</Text>
          {(t.attachments ?? []).map((a) => (
            <Pressable key={a.path} onPress={async () => Linking.openURL(await attachmentUrl(a.path))} accessibilityRole="link">
              <Text style={{ color: colors.primary, fontWeight: '700' }}>📎 {a.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {t.extension ? <Muted>Extension {t.extension.status}: until {when(t.extension.newDeadline)} — {t.extension.reason}{t.extension.progress ? ` (progress: ${t.extension.progress})` : ''}</Muted> : null}

      {mine && (t.status === 'open' || t.status === 'returned') && (
        <>
          <Field label="What did you do? Include any reply you got, or the result of a failed contact attempt" value={resp} onChangeText={setResp} multiline />
          <Muted>Reading the task isn't completing it. Once submitted, your response and files are locked.</Muted>
          {files.map((f, n) => (
            <View key={n} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ color: colors.ink, flex: 1 }}>📎 {f.name}</Text>
              <Pressable onPress={() => setFiles((x) => x.filter((_, j) => j !== n))}><Text style={{ color: colors.red, fontWeight: '700' }}>Remove</Text></Pressable>
            </View>
          ))}
          <Btn label="Attach a file or photo" tone="ghost" onPress={addFile} />
          {err ? <Text style={{ color: colors.red }}>{err}</Text> : null}
          <Btn label="Submit as done" busy={busy} disabled={resp.trim().length < 15 || files.some((f) => !f.blob)} onPress={() => run(async () => { try { await submitTask(t, profile, resp, files); setFiles([]); } catch { setErr('Could not upload. Check your connection and try again.'); } })} />
          {t.extension?.status !== 'pending' && <Btn label={ext ? 'Cancel' : 'Ask for more time'} tone="ghost" onPress={() => setExt((v) => !v)} />}
          {ext && (
            <>
              <Field label="Why do you need more time?" value={reason} onChangeText={setReason} multiline />
              <Field label="How far along are you?" value={progress} onChangeText={setProgress} multiline />
              <DateField label="New deadline" value={d} onChange={setD} />
              <TimeField label="Time" value={tm} onChange={setTm} />
              <Btn label="Send request" disabled={!reason.trim() || !d} busy={busy} onPress={() => run(async () => { await requestExtension(t, profile, reason, progress, at(d, tm)); setExt(false); })} />
            </>
          )}
        </>
      )}
      {boss && t.status === 'submitted' && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Btn label="Send back" tone="ghost" busy={busy} onPress={() => run(() => signOff(t, profile, false))} /></View>
          <View style={{ flex: 1 }}><Btn label="Sign off" busy={busy} onPress={() => run(() => signOff(t, profile, true))} /></View>
        </View>
      )}
      {boss && t.extension?.status === 'pending' && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Btn label="Deny extension" tone="ghost" busy={busy} onPress={() => run(() => decideExtension(t, profile, false))} /></View>
          <View style={{ flex: 1 }}><Btn label="Approve extension" busy={busy} onPress={() => run(() => decideExtension(t, profile, true))} /></View>
        </View>
      )}
    </Card>
  );
}

export function TasksPanel({ canAssign }: { canAssign: boolean }) {
  const { profile } = useAuth();
  const tasks = useAdminTasks(profile);
  const people = usePeople().filter((p) => p.id !== profile?.uid || true);
  const [tab, setTab] = useState<string[]>(['mine']);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [who, setWho] = useState<string[]>([]);
  const [watch, setWatch] = useState<string[]>([]);
  const [d, setD] = useState('');
  const [tm, setTm] = useState('17:00');
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(0);
  if (!profile) return null;

  const mine = tasks.filter((t) => t.assigneeId === profile.uid);
  const given = tasks.filter((t) => t.assignerId === profile.uid);
  const team = tasks.filter((t) => t.assigneeId !== profile.uid && t.assignerId !== profile.uid);
  const list = tab[0] === 'mine' ? mine : tab[0] === 'given' ? given : team;
  const now = new Date();
  const m = new Date(now.getFullYear(), now.getMonth() + month, 1);
  const scores = monthlyScores(tasks, m.getFullYear(), m.getMonth());
  const shownScores = canAssign ? scores : scores.filter((x) => x.id === profile.uid);
  const sorted = [...list].sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || dueOf(a) - dueOf(b));

  async function make() {
    const p = people.find((x) => x.id === who[0]);
    if (!p) return;
    setBusy(true);
    try { await createTask(profile!, { title, details, assignee: { id: p.id, name: p.name }, watchers: watch, deadline: at(d, tm) }); setTitle(''); setDetails(''); setWho([]); setWatch([]); setD(''); setTab(['given']); }
    finally { setBusy(false); }
  }

  return (
    <View style={{ gap: 12 }}>
      <Chips options={[
        { value: 'mine', label: `My tasks (${mine.filter((t) => t.status === 'open' || t.status === 'returned').length})` },
        ...(canAssign ? [{ value: 'given', label: `I assigned (${given.length})` }, { value: 'team', label: 'Team' }, { value: 'new', label: '+ Assign a task' }] : []),
        { value: 'report', label: 'Monthly report' },
      ]} selected={tab} onToggle={(v) => setTab([v])} />

      {tab[0] === 'new' && canAssign && (
        <Card>
          <Text style={s.h2}>Assign a task</Text>
          <Field label="Task" value={title} onChangeText={setTitle} />
          <Field label="Details" value={details} onChangeText={setDetails} multiline />
          <Text style={{ fontWeight: '600' }}>Assign to</Text>
          <Chips options={people.map((p) => ({ value: p.id, label: p.name }))} selected={who} onToggle={(v) => setWho([v])} />
          <Text style={{ fontWeight: '600' }}>Supervisors who can also see it (optional)</Text>
          <Chips options={people.filter((p) => p.id !== who[0]).map((p) => ({ value: p.id, label: p.name }))} selected={watch} onToggle={(v) => setWatch((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]))} />
          <DateField label="Deadline" value={d} onChange={setD} />
          <TimeField label="Time" value={tm} onChange={setTm} />
          <Btn label="Assign task" busy={busy} disabled={!title.trim() || who.length === 0 || !d} onPress={make} />
        </Card>
      )}

      {tab[0] === 'report' ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Btn label="‹" tone="ghost" onPress={() => setMonth((x) => x - 1)} />
            <Text style={s.h2}>{m.toLocaleDateString([], { month: 'long', year: 'numeric' })}</Text>
            <Btn label="›" tone="ghost" onPress={() => setMonth((x) => x + 1)} />
          </View>
          <Muted>Tasks due this month plus anything still overdue from before. Approved extensions don't count against anyone. Late work counts as half.</Muted>
          {shownScores.length === 0 && <Muted>No tasks in this month.</Muted>}
          {shownScores.map((x, i) => (
            <View key={x.id} style={{ gap: 2, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', color: colors.ink }}>{x.name}</Text>
                <Text style={{ fontWeight: '800', color: x.score === null ? colors.inkFaint : x.score >= 80 ? colors.green : x.score >= 60 ? colors.amber : colors.red }}>{x.score === null ? '—' : `${x.score}%`}</Text>
              </View>
              <Muted>{x.assigned} assigned · {x.onTime} on time · {x.late} late · {x.overdue} overdue · {x.extensions} extension{x.extensions === 1 ? '' : 's'} approved</Muted>
            </View>
          ))}
        </Card>
      ) : tab[0] !== 'new' ? (
        <>
          {sorted.length === 0 && <Muted>Nothing here.</Muted>}
          {sorted.map((t) => <TaskCard key={t.id} t={t} />)}
        </>
      ) : null}
    </View>
  );
}
