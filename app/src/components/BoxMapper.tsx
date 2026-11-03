import { Text } from 'react-native';
import type { Box } from './box-types';

/** Placing fields on a flat PDF needs a large screen and the PDF renderer, so it is web-only. */
export function BoxMapper(_props: { data: ArrayBuffer; boxes: Box[]; onAdd: (b: Omit<Box, 'id'>) => void }) {
  return <Text>Placing fields on a scanned or flat PDF is done in the web dashboard.</Text>;
}
