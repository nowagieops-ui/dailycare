import { useLocalSearchParams } from 'expo-router';
import { UnitDetail } from '../../components/UnitViews';
import { Screen } from '../../lib/ui';

export default function AdminUnitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Screen title="Residential Unit"><UnitDetail unitId={String(id)} office /></Screen>;
}
