import { router } from 'expo-router';
import { UnitList } from '../../components/UnitViews';
import { Muted, Screen } from '../../lib/ui';

export default function AdminUnits() {
  return (
    <Screen title="Residential Units">
      <Muted>Homes and apartments, separate from client records: safety checks, maintenance requests and unit messages.</Muted>
      <UnitList office onOpen={(id) => router.push({ pathname: '/admin/unit-detail', params: { id } } as never)} />
    </Screen>
  );
}
