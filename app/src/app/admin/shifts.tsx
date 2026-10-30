import { useState } from 'react';
import { Platform, Text } from 'react-native';
import { collection, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { useClients, useStaff } from '../../lib/admin-data';
import { parseCsv, SHIFT_TEMPLATE, SHIFT_TEMPLATE_HEADERS } from '../../lib/csv';
import { db } from '../../lib/firebase';
import { generateDates, parseLocalDate, shiftWindow, type Pattern, type WeekCycle } from '../../lib/recurrence';
import type { Client, UserProfile } from '../../lib/types';
import { Btn, Card, Chips, Field, Muted, s, Screen } from '../../lib/ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_BATCH = 450; // Firestore batches cap at 500 writes

type Row = { staff: UserProfile & { id: string }; client: Client; start: Date; end: Date; tasks: string[]; phone?: string; address?: string; radius?: number };

async function saveShifts(rows: Row[]) {
  for (let i = 0; i < rows.length; i += MAX_BATCH) {
    const batch = writeBatch(db);
    for (const r of rows.slice(i, i + MAX_BATCH)) {
      batch.set(doc(collection(db, 'shifts')), {
        staffId: r.staff.id,
        staffPhone: r.phone ?? r.staff.phone ?? '',
        clientId: r.client.id,
        clientName: r.client.name,
        serviceLine: r.client.serviceLines[0] ?? '',
        address: r.address ?? r.client.address,
        lat: r.client.lat,
        lng: r.client.lng,
        radiusM: r.radius ?? r.client.radiusM,
        start: Timestamp.fromDate(r.start),
        end: Timestamp.fromDate(r.end),
        status: 'scheduled',
        tasks: r.tasks.map((label, n) => ({ id: `t${n}`, label, done: false })),
        note: '',
      });
    }
    await batch.commit();
  }
}

export default function Shifts() {
  const clients = useClients();
  const allStaff = useStaff();
  const staff = allStaff.filter((u) => u.role === 'staff' || u.role === 'family_staff');

  const [staffId, setStaffId] = useState<string[]>([]);
  const [clientId, setClientId] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState('');
  const [date, setDate] = useState('');
  const [startT, setStartT] = useState('09:00');
  const [endT, setEndT] = useState('17:00');
  const [pattern, setPattern] = useState<Pattern>('once');
  const [cycle, setCycle] = useState<WeekCycle>('odd');
  const [days, setDays] = useState<number[]>([]);
  const [weeks, setWeeks] = useState('4');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const staffPick = staff.find((u) => u.id === staffId[0]);
  const clientPick = clients.find((c) => c.id === clientId[0]);

  function pickStaff(id: string) {
    setStaffId([id]);
    setPhone(staff.find((u) => u.id === id)?.phone ?? ''); // phone prefilled, still editable
  }
  function pickClient(id: string) {
    const c = clients.find((x) => x.id === id);
    setClientId([id]);
    setAddress(c?.address ?? '');
    setRadius(String(c?.radiusM ?? ''));
  }

  const dates = parseLocalDate(date)
    ? generateDates({ startDate: date, pattern, weeks: Number(weeks) || 1, daysOfWeek: days.length ? days : undefined, cycle })
    : [];
  const window0 = dates[0] ? shiftWindow(dates[0], startT, endT) : null;
  const ok = staffPick && clientPick && window0 && dates.length > 0;

  async function create() {
    if (!staffPick || !clientPick) return;
    setBusy(true);
    try {
      const rows: Row[] = [];
      for (const d of dates) {
        const w = shiftWindow(d, startT, endT);
        if (w) rows.push({
          staff: staffPick, client: clientPick, ...w, tasks: clientPick.defaultTasks,
          phone: phone.trim(), address: address.trim(), radius: Number(radius) || clientPick.radiusM,
        });
      }
      await saveShifts(rows);
      setMsg(`Created ${rows.length} shift${rows.length === 1 ? '' : 's'}.`);
    } catch {
      setMsg('Could not create shifts.');
    } finally { setBusy(false); }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([SHIFT_TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'shift-template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function pickCsv() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.csv,text/csv';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 1_000_000) return setMsg('File too large (max 1 MB).');
      const rows = parseCsv(await file.text());
      const [head, ...body] = rows;
      if (!head || SHIFT_TEMPLATE_HEADERS.some((h, i) => head[i]?.trim().toLowerCase() !== h)) {
        return setMsg(`First row must be: ${SHIFT_TEMPLATE_HEADERS.join(',')}`);
      }
      const good: Row[] = [];
      const errors: string[] = [];
      body.forEach((r, i) => {
        const line = i + 2;
        const st = staff.find((u) => u.email === r[0]?.trim().toLowerCase());
        const cl = clients.find((c) => c.name.toLowerCase() === r[1]?.trim().toLowerCase());
        const d = parseLocalDate(r[2] ?? '');
        const w = d ? shiftWindow(d, r[3] ?? '', r[4] ?? '') : null;
        if (!st) errors.push(`Line ${line}: no staff with email "${r[0]}"`);
        else if (!cl) errors.push(`Line ${line}: no client named "${r[1]}"`);
        else if (!w) errors.push(`Line ${line}: bad date or time`);
        else good.push({
          staff: st, client: cl, ...w,
          tasks: r[5]?.trim() ? r[5].split(';').map((t) => t.trim()).filter(Boolean) : cl.defaultTasks,
        });
      });
      // All-or-nothing: a partly imported schedule is worse than none.
      if (errors.length) return setMsg(`Nothing imported.\n${errors.slice(0, 8).join('\n')}`);
      if (!good.length) return setMsg('No rows found.');
      setBusy(true);
      try { await saveShifts(good); setMsg(`Imported ${good.length} shifts.`); }
      catch { setMsg('Import failed.'); }
      finally { setBusy(false); }
    };
    input.click();
  }

  return (
    <Screen title="Shifts">
      <Card>
        <Text style={s.h2}>New shift</Text>
        <Text style={{ fontWeight: '600' }}>Staff</Text>
        <Chips options={staff.map((u) => ({ value: u.id, label: u.name }))} selected={staffId} onToggle={pickStaff} />
        <Field label="Staff phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Text style={{ fontWeight: '600' }}>Client</Text>
        <Chips options={clients.map((c) => ({ value: c.id, label: c.name }))} selected={clientId} onToggle={pickClient} />
        <Field label="Shift location (address)" value={address} onChangeText={setAddress} />
        <Field label="Allowed radius (metres)" value={radius} onChangeText={setRadius} keyboardType="number-pad" />
        <Field label="Start date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-11-02" />
        <Field label="Start time (24h)" value={startT} onChangeText={setStartT} />
        <Field label="End time (24h)" value={endT} onChangeText={setEndT} />

        <Text style={{ fontWeight: '600' }}>Repeat</Text>
        <Chips<Pattern>
          options={[
            { value: 'once', label: 'One-time' }, { value: 'weekly', label: 'Weekly' },
            { value: 'weekdays', label: 'Every weekday' }, { value: 'alternating', label: 'Alternating weeks' },
          ]}
          selected={[pattern]} onToggle={setPattern}
        />
        {(pattern === 'weekly' || pattern === 'alternating') && (
          <>
            <Text style={{ fontWeight: '600' }}>Days</Text>
            <Chips options={DAYS.map((d, i) => ({ value: i, label: d }))} selected={days}
              onToggle={(v) => setDays((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]))} />
          </>
        )}
        {pattern === 'alternating' && (
          <>
            <Text style={{ fontWeight: '600' }}>This staff member works</Text>
            <Chips<WeekCycle>
              options={[{ value: 'odd', label: 'Weeks 1, 3, 5…' }, { value: 'even', label: 'Weeks 2, 4, 6…' }]}
              selected={[cycle]} onToggle={setCycle}
            />
            <Muted>Week 1 is the week of the start date. Create the partner's shifts with the other option.</Muted>
          </>
        )}
        {pattern !== 'once' && <Field label="Number of weeks (max 52)" value={weeks} onChangeText={setWeeks} keyboardType="number-pad" />}

        {ok && <Muted>{dates.length} shift{dates.length === 1 ? '' : 's'}, first on {dates[0].toDateString()}, last on {dates[dates.length - 1].toDateString()}.</Muted>}
        <Btn label={`Create ${dates.length || ''} shift${dates.length === 1 ? '' : 's'}`} onPress={create} busy={busy} disabled={!ok} />
      </Card>

      <Card>
        <Text style={s.h2}>Bulk upload</Text>
        {Platform.OS === 'web' ? (
          <>
            <Muted>Download the template, fill in one row per shift, then upload it. If any row has a problem, nothing is imported.</Muted>
            <Btn label="Download template (CSV)" tone="ghost" onPress={downloadTemplate} />
            <Btn label="Upload CSV" onPress={pickCsv} busy={busy} />
          </>
        ) : (
          <Muted>Bulk upload is available in the web admin dashboard.</Muted>
        )}
      </Card>
      {msg ? <Text style={{ color: msg.startsWith('Created') || msg.startsWith('Imported') ? '#3F8F5F' : '#C1554B' }}>{msg}</Text> : null}
    </Screen>
  );
}
