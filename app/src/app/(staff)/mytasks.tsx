import { TasksPanel } from '../../components/TaskViews';
import { StaffScreen } from '../../lib/staff-ui';

export default function MyTasks() {
  return <StaffScreen title="Tasks from management"><TasksPanel canAssign={false} /></StaffScreen>;
}
