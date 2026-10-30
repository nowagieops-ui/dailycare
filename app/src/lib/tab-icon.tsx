import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

type Name = React.ComponentProps<typeof Ionicons>['name'];

export const tabIcon =
  (name: Name) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={color as string} />
  );
