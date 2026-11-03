import { Text, View } from 'react-native';
import { colors } from '../lib/theme';

/** Browser-native pickers: a click opens the calendar or clock. Values are 'YYYY-MM-DD' and 'HH:mm'. */
function Picker({ label, type, value, onChange, optional }: { label: string; type: 'date' | 'time'; value: string; onChange: (v: string) => void; optional?: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontWeight: '600', color: colors.inkSoft, fontSize: 13 }}>{label}</Text>
      <input
        type={type} value={value} aria-label={label} required={!optional}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* some browsers only open from the icon */ } }}
        style={{ minHeight: 48, border: `1px solid ${colors.line}`, borderRadius: 12, padding: '0 12px', fontSize: 16, background: colors.paper, color: colors.ink, boxSizing: 'border-box', fontFamily: 'inherit', cursor: 'pointer' }}
      />
    </View>
  );
}

export const DateField = (p: { label: string; value: string; onChange: (v: string) => void; optional?: boolean }) => <Picker type="date" {...p} />;
export const TimeField = (p: { label: string; value: string; onChange: (v: string) => void }) => <Picker type="time" {...p} />;
