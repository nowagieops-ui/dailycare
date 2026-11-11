import { useState } from 'react';
import { Linking, Platform, Share, Text } from 'react-native';
import { createFeedUrl, toWebcal } from '../../lib/calendar';
import { colors } from '../../lib/theme';
import { StaffScreen } from '../../lib/staff-ui';
import { Btn, Card, Muted, s } from '../../lib/ui';

export default function CalendarSync() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function make() {
    setBusy(true);
    setErr('');
    try {
      setUrl(await createFeedUrl());
    } catch {
      setErr('Could not create the link. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StaffScreen title="Sync to my calendar">
      <Card>
        <Muted>
          Your shifts can show up in your own phone calendar and update automatically. Events show only the time
          and "Shift – Daily Care Support". Client names and addresses are never put in your calendar.
        </Muted>
        <Btn label={url ? 'Make a new link (turns the old one off)' : 'Create my calendar link'} onPress={make} busy={busy} />
        {err ? <Text style={{ color: colors.red }}>{err}</Text> : null}
      </Card>

      {url ? (
        <>
          <Card>
            <Text style={s.h2}>Your private link</Text>
            <Text selectable style={{ color: colors.ink, fontSize: 13 }}>{url}</Text>
            <Muted>Anyone with this link can see your shift times. Don't share it. If it leaks, make a new one.</Muted>
            {Platform.OS === 'ios' && <Btn label="Add to Apple Calendar" onPress={() => Linking.openURL(toWebcal(url))} />}
            <Btn label="Copy or share link" tone="ghost" onPress={() => Share.share({ message: url })} />
          </Card>
          <Card>
            <Text style={s.h2}>Google Calendar</Text>
            <Muted>
              On a computer, open calendar.google.com. Next to "Other calendars" click +, choose "From URL", paste
              the link, and click "Add calendar". It then appears on your phone too.
            </Muted>
            <Muted>Google refreshes subscribed calendars on its own schedule, so changes can take several hours to appear. The app is always up to date.</Muted>
          </Card>
        </>
      ) : null}
    </StaffScreen>
  );
}
