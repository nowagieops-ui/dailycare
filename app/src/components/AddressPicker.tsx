import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { newSessionToken, placeDetails, suggest, type PickedPlace, type Suggestion } from '../lib/places';
import { colors, radius } from '../lib/theme';
import { s } from '../lib/ui';

/**
 * Address search. Typing shows matching addresses; choosing one fills the exact map location, so the
 * location check at clock-in uses the same point as the address. Editing the text clears the location.
 */
export function AddressPicker({ label, value, confirmed, onText, onPick }: {
  label: string; value: string; confirmed: boolean; onText: (t: string) => void; onPick: (p: PickedPlace) => void;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [msg, setMsg] = useState('');
  const token = useRef(newSessionToken());
  const skip = useRef(false);

  useEffect(() => {
    if (skip.current) { skip.current = false; return; }
    if (value.trim().length < 4) { setItems([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try { setItems(await suggest(value.trim(), token.current, ctl.signal)); setMsg(''); }
      catch (e) { if (!ctl.signal.aborted) { setItems([]); setMsg('Address search is unavailable right now.'); } }
    }, 300);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [value]);

  async function choose(x: Suggestion) {
    try {
      const p = await placeDetails(x.placeId, token.current);
      skip.current = true; setItems([]); setMsg('');
      token.current = newSessionToken(); // a selection ends the billing session
      onPick({ ...p, address: p.address || x.text });
    } catch { setMsg('Could not get that location. Try another address.'); }
  }

  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontWeight: '600', color: colors.inkSoft, fontSize: 13 }}>{label}</Text>
      <TextInput value={value} onChangeText={onText} placeholder="Start typing the street address" placeholderTextColor={colors.inkFaint}
        autoCapitalize="words" autoCorrect={false} style={[s.input, confirmed && { borderColor: colors.green }]} />
      {items.length > 0 && (
        <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.paper, overflow: 'hidden' }}>
          {items.map((x, i) => (
            <Pressable key={x.placeId} onPress={() => choose(x)} accessibilityRole="button" style={{ padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
              <Text style={{ color: colors.ink }}>{x.text}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {confirmed ? <Text style={{ color: colors.green, fontSize: 12, fontWeight: '600' }}>✓ Location found. The clock-in check will use this address.</Text>
        : <Text style={{ color: colors.inkFaint, fontSize: 12 }}>Pick an address from the list so its location can be tracked.</Text>}
      {msg ? <Text style={{ color: colors.red, fontSize: 12 }}>{msg}</Text> : null}
    </View>
  );
}
