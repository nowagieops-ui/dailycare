import { router } from 'expo-router';
import { ChatList } from '../../components/ChatViews';
import { StaffScreen } from '../../lib/staff-ui';

export default function Chat() {
  return (
    <StaffScreen title="Team Chat">
      <ChatList onOpen={(id) => router.push({ pathname: '/chat-thread', params: { id } } as never)} onAnnouncements={() => router.push('/announcements' as never)} />
    </StaffScreen>
  );
}
