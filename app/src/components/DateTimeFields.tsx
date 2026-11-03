import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, radius } from '../lib/theme';
import { s } from '../lib/ui';

/** Values stay plain strings ('YYYY-MM-DD' and 'HH:mm', 24h) so the scheduling code that parses them is unchanged. */
const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date());
const toTime = (v: string) => { const [h, m] = /^\d{2}:\d{2}$/.test(v) ? v.split(':').map(Number) : [9, 0]; const d = new Date(); d.setHours(h, m, 0, 0); return d; };
const fmtDate = (v: string) => (v ? toDate(v).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'Choose a date');
const fmtTime = (v: string) => (v ? toTime(v).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Choose a time');

function Picker({ label, mode, value, onChange, optional }: { label: string; mode: 'date' | 'time'; value: string; onChange: (v: string) => void; optional?: boolean }) {
  const [open, setOpen] = useState(false);
  const date = mode === 'date' ? toDate(value) : toTime(value);
  const handle = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (e.type === 'dismissed' || !d) return;
    onChange(mode === 'date' ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : `${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontWeight: '600', color: colors.inkSoft, fontSize: 13 }}>{label}</Text>
      {Platform.OS === 'ios' ? (
        // iOS shows its own compact tap-to-open control.
        <View style={{ alignItems: 'flex-start' }}>
          <DateTimePicker value={date} mode={mode} display="compact" onChange={handle} />
          {!value && <Text style={{ color: colors.inkFaint, fontSize: 12 }}>Not set yet. Tap to choose.</Text>}
        </View>
      ) : (
        <>
          <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={[s.input, { justifyContent: 'center' }]}>
            <Text style={{ color: value ? colors.ink : colors.inkFaint, fontSize: 16 }}>{mode === 'date' ? fmtDate(value) : fmtTime(value)}</Text>
          </Pressable>
          {open && <DateTimePicker value={date} mode={mode} is24Hour={false} onChange={handle} />}
        </>
      )}
      {optional && value ? <Pressable onPress={() => onChange('')}><Text style={{ color: colors.primary, fontSize: 12 }}>Clear</Text></Pressable> : null}
    </View>
  );
}

export const DateField = (p: { label: string; value: string; onChange: (v: string) => void; optional?: boolean }) => <Picker mode="date" {...p} />;
export const TimeField = (p: { label: string; value: string; onChange: (v: string) => void }) => <Picker mode="time" {...p} />;
export { radius };
