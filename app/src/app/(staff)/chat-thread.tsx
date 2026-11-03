import { Pressable, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChatThread } from '../../components/ChatViews';
import { StaffScreen } from '../../lib/staff-ui';
import { colors } from '../../lib/theme';

export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <StaffScreen title="">
      <Pressable onPress={() => router.replace('/chat' as never)}><Text style={{ color: colors.primary, fontWeight: '700' }}>← Team Chat</Text></Pressable>
      <ChatThread chatId={String(id)} />
    </StaffScreen>
  );
}
