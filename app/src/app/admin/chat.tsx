import { router } from 'expo-router';
import { ChatList } from '../../components/ChatViews';
import { Screen } from '../../lib/ui';

export default function AdminChat() {
  return (
    <Screen title="Team Chat">
      <ChatList onOpen={(id) => router.push({ pathname: '/admin/chat-thread', params: { id } } as never)} onAnnouncements={() => router.push('/admin/announcements' as never)} />
    </Screen>
  );
}
