import { useEffect, useState } from 'react';
import { Text, TextInput } from 'react-native';
import { useAuth } from '../../lib/auth';
import { pickCurrent, saveNote, useMyShifts } from '../../lib/shifts';
import { Btn, Card, Muted, s, Screen } from '../../lib/ui';

export default function Notes() {
  const { profile } = useAuth();
  const { shifts } = useMyShifts(profile?.uid);
  const shift = pickCurrent(shifts);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (shift) setText(shift.note);
  }, [shift?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!shift || shift.status !== 'clocked_in') {
    return <Screen title="Daily Notes"><Muted>Clock in to write today's note.</Muted></Screen>;
  }
  return (
    <Screen title="Daily Notes">
      <Card>
        <Text style={s.h2}>{shift.clientName}</Text>
        <TextInput
          style={[s.input, { minHeight: 160, textAlignVertical: 'top', paddingTop: 12 }]}
          multiline value={text}
          onChangeText={(v) => { setText(v); setSaved(false); }}
          placeholder="What happened during this visit? Mood, meals, activities, concerns…"
        />
        <Btn
          label={saved ? 'Saved' : 'Save note'}
          onPress={async () => { await saveNote(shift.id, text); setSaved(true); }}
        />
        <Muted>The note is required before you can clock out.</Muted>
      </Card>
    </Screen>
  );
}
