import { TasksPanel } from '../../components/TaskViews';
import { Muted, Screen } from '../../lib/ui';

export default function AdminTasks() {
  return (
    <Screen title="Tasks & performance">
      <Muted>Assign work with a deadline. The person responds with what they did, you sign it off, and the monthly report shows who is on time. Unfinished tasks carry forward and stay overdue until they are done.</Muted>
      <TasksPanel canAssign />
    </Screen>
  );
}
