import { router } from 'expo-router';
import { UnitList } from '../../components/UnitViews';
import { StaffScreen } from '../../lib/staff-ui';

export default function Units() {
  return <StaffScreen title="Residential Units"><UnitList office={false} onOpen={(id) => router.push({ pathname: '/unit-detail', params: { id } } as never)} /></StaffScreen>;
}
