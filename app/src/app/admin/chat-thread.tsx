import { useLocalSearchParams } from 'expo-router';
import { ChatThread } from '../../components/ChatViews';
import { Screen } from '../../lib/ui';

export default function AdminChatThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen title="Team Chat">
      <ChatThread chatId={String(id)} />
    </Screen>
  );
}
