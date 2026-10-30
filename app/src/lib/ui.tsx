import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from './theme';

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.h1} accessibilityRole="header">{title}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Btn({
  label, onPress, disabled, busy, tone = 'primary',
}: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; tone?: 'primary' | 'danger' | 'ghost' }) {
  const bg = tone === 'danger' ? colors.red : tone === 'ghost' ? colors.tint : colors.primary;
  const fg = tone === 'ghost' ? colors.primary : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={[s.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : 1 }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Pill({ text, tone }: { text: string; tone: 'green' | 'amber' | 'red' | 'blue' }) {
  const map = {
    green: [colors.greenBg, colors.green], amber: [colors.amberBg, colors.amber],
    red: [colors.redBg, colors.red], blue: [colors.tint, colors.primary],
  } as const;
  return (
    <View style={[s.pill, { backgroundColor: map[tone][0] }]}>
      <Text style={{ color: map[tone][1], fontWeight: '700', fontSize: 12 }}>{text}</Text>
    </View>
  );
}

export const Muted = ({ children }: { children: ReactNode }) => <Text style={s.muted}>{children}</Text>;

export const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const fmtDay = (ms: number) =>
  new Date(ms).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  h1: { fontSize: 24, fontWeight: '800', color: colors.navy },
  h2: { fontSize: 16, fontWeight: '700', color: colors.navy },
  card: {
    backgroundColor: colors.paper, borderRadius: radius.lg, padding: 16, gap: 8,
    borderWidth: 1, borderColor: colors.line,
  },
  btn: { minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnText: { fontSize: 16, fontWeight: '700' },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  muted: { color: colors.inkSoft, fontSize: 14 },
  input: {
    minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    paddingHorizontal: 12, fontSize: 16, backgroundColor: colors.paper, color: colors.ink,
  },
});

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontWeight: '600', color: colors.inkSoft, fontSize: 13 }}>{label}</Text>
      <TextInput style={s.input} placeholderTextColor={colors.inkFaint} {...props} />
    </View>
  );
}

export function Chips<T extends string | number>({
  options, selected, onToggle,
}: { options: { value: T; label: string }[]; selected: T[]; onToggle: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <Pressable
            key={String(o.value)} onPress={() => onToggle(o.value)} accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
              borderColor: on ? colors.primary : colors.line, backgroundColor: on ? colors.tint : colors.paper,
            }}
          >
            <Text style={{ color: on ? colors.primary : colors.inkSoft, fontWeight: '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
