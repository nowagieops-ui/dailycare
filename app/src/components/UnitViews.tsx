import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { useShiftsBetween } from '../lib/admin-data';
import { SupplyFlowSetup, SupplyQueue, UnitSupplies } from './SupplyViews';
import { colors } from '../lib/theme';
import {
  addLog, addPost, addRequest, addUnit, EMERGENCY_ITEMS, LOG_KINDS, nightSlots, retireUnit, setRequestStatus, setUnitRules, slotState,
  useUnitChecks, useUnitLogs, useUnitPosts, useUnitRequests, useUnits, type LogKind, type Priority, type Unit,
} from '../lib/units';
import { Btn, Card, Chips, Field, fmtDay, fmtTime, Muted, s, Tag } from '../lib/ui';
import { addDays, startOfDay } from '../lib/week';

const stamp = (t?: { toMillis: () => number } | null) => (t ? `${fmtDay(t.toMillis())} ${fmtTime(t.toMillis())}` : 'just now');

/** Units list. Office users can also add a unit. Shared by the admin console and the DSP app. */
export function UnitList({ office, onOpen }: { office: boolean; onOpen: (id: string) => void }) {
  const units = useUnits();
  const open = useUnitRequests();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<string[]>(['home']);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  async function save() {
    await addUnit({ name: name.trim(), type: type[0] as Unit['type'], address: address.trim(), notes: notes.trim() });
    setName(''); setAddress(''); setNotes(''); setAdding(false);
  }
  return (
    <View style={{ gap: 12 }}>
      <SupplyQueue />
      {office && <SupplyFlowSetup />}
      {office && <Btn label={adding ? 'Cancel' : '+ Add residential unit'} tone={adding ? 'ghost' : 'primary'} onPress={() => setAdding((v) => !v)} />}
      {adding && (
        <Card>
          <Text style={s.h2}>New residential unit</Text>
          <Field label="Name (e.g. Oak Street Home, Apt 4B)" value={name} onChangeText={setName} />
          <Chips options={[{ value: 'home', label: 'Home' }, { value: 'apartment', label: 'Apartment' }]} selected={type} onToggle={(v) => setType([v])} />
          <Field label="Address" value={address} onChangeText={setAddress} />
          <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
          <Btn label="Save unit" onPress={save} disabled={!name.trim()} />
        </Card>
      )}
      {units.length === 0 && <Muted>{office ? 'No units yet. Add the homes and apartments you run.' : 'No residential units have been set up yet.'}</Muted>}
      {units.map((u) => {
        const n = open.filter((r) => r.unitId === u.id).length;
        return (
          <Pressable key={u.id} onPress={() => onOpen(u.id)} accessibilityRole="link">
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink, flex: 1 }}>{u.name}</Text>
                {n > 0 && <Tag text={`${n} open request${n > 1 ? 's' : ''}`} tone="amber" />}
              </View>
              <Muted>{u.type === 'home' ? 'Home' : 'Apartment'}{u.address ? ` · ${u.address}` : ''}</Muted>
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}

function CheckForm({ unit, kind }: { unit: Unit; kind: LogKind }) {
  const { profile } = useAuth();
  const def = LOG_KINDS[kind];
  const [vals, setVals] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = kind === 'emergency_box' ? EMERGENCY_ITEMS.every((i) => vals[i]) : def.fields.every((f) => vals[f.key]?.trim() && !isNaN(Number(vals[f.key])));
  async function save() {
    if (!profile) return;
    setBusy(true);
    try { await addLog(unit, kind, vals, note, profile); setVals({}); setNote(''); } finally { setBusy(false); }
  }
  return (
    <Card>
      <Text style={s.h2}>{def.label}</Text>
      {def.fields.map((f) => (
        <Field key={f.key} label={f.label} value={vals[f.key] ?? ''} onChangeText={(t) => setVals((v) => ({ ...v, [f.key]: t }))} keyboardType="numbers-and-punctuation" />
      ))}
      {kind === 'emergency_box' && EMERGENCY_ITEMS.map((i) => (
        <View key={i} style={{ gap: 6 }}>
          <Text style={{ fontWeight: '600', color: colors.ink }}>{i}</Text>
          <Chips options={[{ value: 'yes', label: 'Present' }, { value: 'no', label: 'Missing' }]} selected={vals[i] ? [vals[i]] : []} onToggle={(v) => setVals((x) => ({ ...x, [i]: v }))} />
        </View>
      ))}
      <Field label="Note (optional)" value={note} onChangeText={setNote} />
      <Btn label="Save check" onPress={save} busy={busy} disabled={!ready} />
    </Card>
  );
}

/** One unit: checks, maintenance requests and unit messages. */
export function UnitDetail({ unitId, office }: { unitId: string; office: boolean }) {
  const { profile } = useAuth();
  const unit = useUnits().find((u) => u.id === unitId);
  const logs = useUnitLogs(unitId);
  const reqs = useUnitRequests(unitId);
  const posts = useUnitPosts(unitId);
  const checks = useUnitChecks(office ? unitId : undefined);
  const today = startOfDay(new Date());
  const unitShifts = useShiftsBetween(addDays(today, -14), addDays(today, 1)).filter((x) => x.unitId === unitId && !!x.clockInAt);
  const [tab, setTab] = useState<string[]>(['checks']);
  const [kind, setKind] = useState<string[]>(['hot_water']);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [prio, setPrio] = useState<string[]>(['routine']);
  const [post, setPost] = useState('');
  if (!unit || !profile) return <Muted>Loading…</Muted>;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text style={s.h1}>{unit.name}</Text>
        <Muted>{unit.type === 'home' ? 'Home' : 'Apartment'}{unit.address ? ` · ${unit.address}` : ''}</Muted>
        {unit.notes ? <Muted>{unit.notes}</Muted> : null}
      </View>
      <Chips options={[{ value: 'checks', label: 'Safety checks' }, { value: 'maint', label: `Maintenance (${reqs.filter((r) => r.status !== 'done').length})` }, { value: 'supplies', label: 'Supplies' }, { value: 'board', label: 'Unit messages' }, ...(office ? [{ value: 'night', label: 'Night checks & rules' }] : [])]}
        selected={tab} onToggle={(v) => setTab([v])} />

      {tab[0] === 'checks' && (
        <>
          <Chips options={(Object.keys(LOG_KINDS) as LogKind[]).map((k) => ({ value: k as string, label: LOG_KINDS[k].label }))} selected={kind} onToggle={(v) => setKind([v])} />
          <CheckForm key={kind[0]} unit={unit} kind={kind[0] as LogKind} />
          <Text style={s.h2}>Recent checks</Text>
          {logs.length === 0 && <Muted>Nothing logged yet.</Muted>}
          {logs.slice(0, 30).map((l) => (
            <Card key={l.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{LOG_KINDS[l.kind].label}</Text>
                {l.flagged && <Tag text="Out of range" tone="red" />}
              </View>
              <Text style={{ color: colors.ink }}>
                {l.kind === 'emergency_box'
                  ? (Object.entries(l.values).filter(([, v]) => v === 'no').map(([k]) => k).join(', ') || 'Everything present')
                  : LOG_KINDS[l.kind].fields.map((f) => `${f.label.replace(/ \(.*/, '')}: ${l.values[f.key]}°F`).join(' · ')}
              </Text>
              <Muted>{l.byName} · {stamp(l.at)}{l.note ? ` · ${l.note}` : ''}</Muted>
            </Card>
          ))}
        </>
      )}

      {tab[0] === 'maint' && (
        <>
          <Card>
            <Text style={s.h2}>Report a maintenance issue</Text>
            <Field label="What needs fixing?" value={title} onChangeText={setTitle} />
            <Field label="Details" value={details} onChangeText={setDetails} multiline />
            <Chips options={[{ value: 'routine', label: 'Routine' }, { value: 'urgent', label: 'Urgent' }]} selected={prio} onToggle={(v) => setPrio([v])} />
            <Btn label="Send to the office" disabled={!title.trim()} onPress={async () => { await addRequest(unit, title, details, prio[0] as Priority, profile); setTitle(''); setDetails(''); setPrio(['routine']); }} />
          </Card>
          {reqs.length === 0 && <Muted>No maintenance requests.</Muted>}
          {reqs.map((r) => (
            <Card key={r.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{r.title}</Text>
                {r.priority === 'urgent' && <Tag text="Urgent" tone="red" />}
                <Tag text={r.status === 'done' ? 'Done' : r.status === 'in_progress' ? 'In progress' : 'Open'} tone={r.status === 'done' ? 'green' : 'amber'} />
              </View>
              {r.details ? <Text style={{ color: colors.ink }}>{r.details}</Text> : null}
              <Muted>{r.byName} · {stamp(r.createdAt)}</Muted>
              {office && r.status !== 'done' && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {r.status === 'open' && <View style={{ flex: 1 }}><Btn label="Start" tone="ghost" onPress={() => setRequestStatus(r.id, 'in_progress')} /></View>}
                  <View style={{ flex: 1 }}><Btn label="Mark done" onPress={() => setRequestStatus(r.id, 'done')} /></View>
                </View>
              )}
            </Card>
          ))}
        </>
      )}

      {tab[0] === 'supplies' && <UnitSupplies unit={unit} />}

      {tab[0] === 'night' && office && (
        <>
          <Card>
            <Text style={s.h2}>Rules for this unit</Text>
            <Muted>A DSP working a shift in this unit cannot clock out until the required logs are done by them during that shift.</Muted>
            <Text style={{ fontWeight: '600' }}>Logs required before clock-out</Text>
            <Chips options={(Object.keys(LOG_KINDS) as LogKind[]).map((k) => ({ value: k as string, label: LOG_KINDS[k].label }))} selected={(unit.requiredLogs ?? []) as string[]}
              onToggle={(v) => { const cur = unit.requiredLogs ?? []; setUnitRules(unit.id, { requiredLogs: (cur.includes(v as LogKind) ? cur.filter((x) => x !== v) : [...cur, v as LogKind]) }); }} />
            <Text style={{ fontWeight: '600' }}>Overnight</Text>
            <Chips options={[{ value: 'n', label: 'Hourly night status checks (10pm–6am)' }]} selected={unit.nightChecks ? ['n'] : []} onToggle={() => setUnitRules(unit.id, { nightChecks: !unit.nightChecks })} />
            <Muted>Each check opens 15 minutes before the hour and locks 5 minutes after, so it cannot be filled in later. Missed checks are recorded here and count against the DSP's performance.</Muted>
          </Card>
          <Text style={s.h2}>Last 14 days</Text>
          {unitShifts.length === 0 && <Muted>No worked shifts for this unit yet. Pick the unit when you create a shift.</Muted>}
          {unitShifts.map((sh) => {
            const slots = unit.nightChecks ? nightSlots(sh) : [];
            const mine = checks.filter((c) => c.shiftId === sh.id);
            const missed = slots.filter((t) => slotState(t, mine.some((c) => c.slot.toMillis() === t)) === 'missed');
            return (
              <Card key={sh.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={{ fontWeight: '700', color: colors.ink }}>{sh.staffName || 'DSP'} · {fmtDay(sh.start.toMillis())}</Text>
                  {slots.length > 0 && <Tag text={missed.length ? `${missed.length} missed` : 'All checks done'} tone={missed.length ? 'red' : 'green'} />}
                </View>
                {slots.length === 0 ? <Muted>No overnight checks in this shift.</Muted> : slots.map((t) => {
                  const c = mine.find((x) => x.slot.toMillis() === t);
                  return <Text key={t} style={{ color: c ? colors.ink : colors.red }}>{fmtTime(t)} — {c ? `${c.status}${c.note ? ` (${c.note})` : ''}` : slotState(t, false) === 'missed' ? 'Missed' : 'Not due yet'}</Text>;
                })}
              </Card>
            );
          })}
        </>
      )}

      {tab[0] === 'board' && (
        <>
          <Card>
            <Field label="Message to everyone at this unit (supplies, repairs, reminders)" value={post} onChangeText={setPost} multiline />
            <Btn label="Post" disabled={!post.trim()} onPress={async () => { await addPost(unit, post, profile); setPost(''); }} />
          </Card>
          {posts.length === 0 && <Muted>No messages for this unit yet.</Muted>}
          {posts.map((p) => (
            <Card key={p.id}><Text style={{ color: colors.ink }}>{p.text}</Text><Muted>{p.byName} · {stamp(p.at)}</Muted></Card>
          ))}
        </>
      )}

      {office && profile.role !== 'case_manager' && <Btn label="Remove this unit" tone="danger" onPress={() => retireUnit(unit.id)} />}
    </View>
  );
}
