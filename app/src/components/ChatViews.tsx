import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { chatTitle, sendMessage, startChat, useChats, useMessages, usePeople, type Chat } from '../lib/chat';
import { useAnnouncements } from '../lib/shifts';
import { colors } from '../lib/theme';
import { Btn, Card, Chips, fmtDay, fmtTime, initials, Muted, s } from '../lib/ui';

const when = (ms: number) => (Date.now() - ms < 86400000 ? fmtTime(ms) : fmtDay(ms));

/** Team Chat list: announcements pinned on top, then conversations; shared by the staff app and admin console. */
export function ChatList({ onOpen, onAnnouncements }: { onOpen: (id: string) => void; onAnnouncements: () => void }) {
  const { profile } = useAuth();
  const chats = useChats(profile?.uid);
  const people = usePeople().filter((p) => p.id !== profile?.uid);
  const latest = useAnnouncements()[0];
  const [composing, setComposing] = useState(false);
  const [pick, setPick] = useState<string[]>([]);
  if (!profile) return null;

  async function go() {
    const id = await startChat(profile!, people.filter((p) => pick.includes(p.id)), chats);
    setComposing(false); setPick([]); onOpen(id);
  }

  return (
    <View style={{ gap: 10 }}>
      <Btn label={composing ? 'Cancel' : 'New message'} tone="ghost" onPress={() => setComposing((c) => !c)} />
      {composing && (
        <Card>
          <Text style={s.h2}>Who is this message for?</Text>
          <Chips options={people.map((p) => ({ value: p.id, label: p.name }))} selected={pick}
            onToggle={(v) => setPick((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]))} />
          <Btn label={pick.length > 1 ? 'Start group chat' : 'Start chat'} onPress={go} disabled={pick.length === 0} />
        </Card>
      )}
      <Pressable onPress={onAnnouncements}>
        <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '800' }}>DC</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colors.ink }}>Agency Announcements</Text>
            <Text numberOfLines={1} style={{ color: colors.inkSoft, fontSize: 13 }}>{latest ? `${latest.title} — ${latest.body}` : 'Nothing yet'}</Text>
          </View>
          {latest && <Text style={{ color: colors.inkFaint, fontSize: 12 }}>{when(latest.createdAt.toMillis())}</Text>}
        </Card>
      </Pressable>
      {chats.length === 0 && <Muted>No conversations yet. Use "New message" to start one.</Muted>}
      {chats.map((c: Chat) => {
        const t = chatTitle(c, profile.uid);
        return (
          <Pressable key={c.id} onPress={() => onOpen(c.id)}>
            <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '700' }}>{initials(t)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontWeight: '700', color: colors.ink }}>{t}</Text>
                <Text numberOfLines={1} style={{ color: colors.inkSoft, fontSize: 13 }}>{c.lastText ?? 'No messages yet'}</Text>
              </View>
              {c.lastAt && <Text style={{ color: colors.inkFaint, fontSize: 12 }}>{when(c.lastAt.toMillis())}</Text>}
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ChatThread({ chatId }: { chatId: string }) {
  const { profile } = useAuth();
  const chat = useChats(profile?.uid).find((c) => c.id === chatId);
  const msgs = useMessages(chatId);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  if (!profile) return null;

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try { await sendMessage(chatId, profile!, text); setText(''); } finally { setBusy(false); }
  }

  return (
    <View style={{ gap: 10 }}>
      <Text style={s.h1}>{chat ? chatTitle(chat, profile.uid) : 'Chat'}</Text>
      <Muted>Do not put client names or health details in chat unless they are needed for care.</Muted>
      {msgs.map((m) => {
        const mine = m.senderId === profile.uid;
        return (
          <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            {!mine && <Text style={{ fontSize: 11, color: colors.inkFaint, marginLeft: 4 }}>{m.senderName}</Text>}
            <View style={{ backgroundColor: mine ? colors.primary : colors.paper, borderWidth: mine ? 0 : 1, borderColor: colors.line, borderRadius: 14, padding: 10 }}>
              <Text style={{ color: mine ? '#fff' : colors.ink }}>{m.text}</Text>
            </View>
            <Text style={{ fontSize: 10, color: colors.inkFaint, alignSelf: mine ? 'flex-end' : 'flex-start', marginHorizontal: 4 }}>{m.at ? when(m.at.toMillis()) : ''}</Text>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput value={text} onChangeText={setText} placeholder="Message" placeholderTextColor={colors.inkFaint} maxLength={2000} onSubmitEditing={send}
          style={[s.input, { flex: 1 }]} />
        <View style={{ width: 90 }}><Btn label="Send" onPress={send} busy={busy} disabled={!text.trim()} /></View>
      </View>
    </View>
  );
}
