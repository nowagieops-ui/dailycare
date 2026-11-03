import { Pressable, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChatThread } from '../../components/ChatViews';
import { colors } from '../../lib/theme';
import { Screen } from '../../lib/ui';

export default function AdminChatThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen title="Team Chat">
      <Pressable onPress={() => router.replace('/admin/chat' as never)}><Text style={{ color: colors.primary, fontWeight: '700' }}>← Team Chat</Text></Pressable>
      <ChatThread chatId={String(id)} />
    </Screen>
  );
}
