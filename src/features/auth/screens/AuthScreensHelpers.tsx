import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

export function AuthButtonRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
});
