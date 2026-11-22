import { useLocalSearchParams } from 'expo-router';
import { UnitDetail } from '../../components/UnitViews';
import { StaffScreen } from '../../lib/staff-ui';

export default function StaffUnitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StaffScreen title="Residential Unit"><UnitDetail unitId={String(id)} office={false} /></StaffScreen>;
}
