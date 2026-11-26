import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { ADMIN_TOUR, DSP_TOUR } from '../lib/tour-steps';
import { colors } from '../lib/theme';
import { Btn } from '../lib/ui';

type Listener = (kind: 'admin' | 'dsp' | null) => void;
const listeners = new Set<Listener>();
export const startTour = (kind: 'admin' | 'dsp') => listeners.forEach((l) => l(kind));

/** A self-paced, step-by-step tour. It opens the real screens behind the card so people see what is being described. */
export function TourHost() {
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const [kind, setKind] = useState<'admin' | 'dsp' | null>(null);
  const [i, setI] = useState(0);
  useEffect(() => { const l: Listener = (k) => { setKind(k); setI(0); }; listeners.add(l); return () => { listeners.delete(l); }; }, []);
  const steps = kind === 'admin' ? ADMIN_TOUR.filter((s) => !s.superOnly || profile?.role === 'super_admin') : DSP_TOUR;
  const step = steps[i];
  useEffect(() => { if (kind && step?.route) router.push(step.route as never); }, [kind, i]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!kind || !step) return null;
  const last = i === steps.length - 1;
  const wide = width >= 700;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, justifyContent: 'flex-end', alignItems: wide ? 'flex-end' : 'stretch', padding: 12, zIndex: 1000 }}>
      <View accessibilityRole="summary" style={{ width: wide ? 400 : '100%', maxHeight: '72%', backgroundColor: colors.paper, borderRadius: 16, borderWidth: 1, borderColor: colors.primary, padding: 16, gap: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>TOUR · STEP {i + 1} OF {steps.length}</Text>
          <Pressable onPress={() => setKind(null)} accessibilityRole="button" accessibilityLabel="Close the tour"><Text style={{ color: colors.inkSoft, fontWeight: '700' }}>Skip ✕</Text></Pressable>
        </View>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.tint }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.primary, width: `${((i + 1) / steps.length) * 100}%` }} />
        </View>
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.navy }}>{step.title}</Text>
          <Text style={{ color: colors.ink, lineHeight: 21 }}>{step.body}</Text>
          {step.points?.map((p, n) => (
            <View key={n} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ color: colors.primary, fontWeight: '800' }}>•</Text>
              <Text style={{ flex: 1, color: colors.ink, lineHeight: 20 }}>{p}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Btn label="Back" tone="ghost" disabled={i === 0} onPress={() => setI((x) => Math.max(0, x - 1))} /></View>
          <View style={{ flex: 1 }}><Btn label={last ? 'Finish' : 'Next'} onPress={() => (last ? setKind(null) : setI((x) => x + 1))} /></View>
        </View>
      </View>
    </View>
  );
}
