import { createContext, useContext, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from './theme';

/** Set by the admin shell: the page sits inside the console chrome, so it needs no safe-area, title or narrow column. */
export const EmbeddedCtx = createContext(false);

export function Screen({ title, children, header }: { title: string; children: ReactNode; header?: ReactNode }) {
  const embedded = useContext(EmbeddedCtx);
  const body = (
    <ScrollView contentContainerStyle={[s.content, embedded && { maxWidth: 1200 }]}>
      {title && !embedded ? <Text style={s.h1} accessibilityRole="header">{title}</Text> : null}
      {children}
    </ScrollView>
  );
  if (embedded) return body;
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {header}
      {body}
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

/** Small "i" that explains a field. Hover (web) or tap to show; tap again to pin/close. */
export function InfoTip({ text }: { text: string }) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More info"
        onPress={() => setPinned((p) => !p)}
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        style={{
          width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.tint, borderWidth: 1, borderColor: colors.primary,
        }}
      >
        <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }}>i</Text>
      </Pressable>
      {(pinned || hover) && (
        <View style={{ backgroundColor: colors.tint, borderRadius: radius.sm, padding: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 18 }}>{text}</Text>
        </View>
      )}
    </View>
  );
}

// ---- Mockup components (card styles, tags, stat tiles, header) ----

export const Eyebrow = ({ children }: { children: ReactNode }) => (
  <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.inkFaint }}>{children}</Text>
);

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'neutral';
const TAG: Record<Tone, [string, string]> = {
  green: [colors.greenBg, colors.green], amber: [colors.amberBg, colors.amber], red: [colors.redBg, colors.red],
  blue: [colors.tint, colors.primary], neutral: ['#EEF0EE', colors.inkSoft],
};
export function Tag({ text, tone = 'neutral' }: { text: string; tone?: Tone }) {
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: TAG[tone][0] }}>
      <Text style={{ color: TAG[tone][1], fontWeight: '700', fontSize: 12 }}>{text}</Text>
    </View>
  );
}

export function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={[s.card, { flex: 1, gap: 4 }]}>
      <Text style={{ fontSize: 12, color: colors.inkSoft }}>{label}</Text>
      <Text style={{ fontSize: 28, fontWeight: '800', color: colors.navy }}>{value}</Text>
    </View>
  );
}

/** Tappable card row with an icon bubble and chevron (mockup "card-flat" link). */
export function RowLink({
  icon, tint = colors.primary, bg = colors.tint, title, sub, href,
}: { icon: keyof typeof Ionicons.glyphMap; tint?: string; bg?: string; title: string; sub?: string; href: string }) {
  return (
    <Pressable onPress={() => router.push(href as never)} accessibilityRole="link" style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>{title}</Text>
        {sub ? <Text style={{ fontSize: 12, color: colors.inkFaint }}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
    </Pressable>
  );
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

/** Staff app header from the mockup: avatar + name/role on the left, bell and settings on the right. */
export function StaffHeader({ name, roleLabel }: { name: string; roleLabel: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.paper, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{initials(name)}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{name}</Text>
          <Text style={{ fontSize: 12, color: colors.inkFaint }}>{roleLabel}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <Pressable accessibilityLabel="Open notifications" onPress={() => router.push('/notifications' as never)} style={{ padding: 8 }}>
          <Ionicons name="notifications-outline" size={22} color={colors.primary} />
        </Pressable>
        <Pressable accessibilityLabel="Open settings" onPress={() => router.push('/settings' as never)} style={{ padding: 8 }}>
          <Ionicons name="settings-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}
