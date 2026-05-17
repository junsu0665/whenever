import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '../theme';

export function MealTray() {
  return (
    <View style={styles.tray}>
      <View style={[styles.dish, styles.rice]} />
      <View style={[styles.dish, styles.soup]} />
      <View style={[styles.smallDish, styles.main]} />
      <View style={[styles.smallDish, styles.kimchi]} />
      <View style={[styles.smallDish, styles.side]} />
    </View>
  );
}

const styles = StyleSheet.create({
  dish: {
    borderColor: colors.surface,
    borderRadius: 999,
    borderWidth: 3,
    height: 70,
    width: 70,
  },
  kimchi: {
    backgroundColor: colors.coralSoft,
  },
  main: {
    backgroundColor: colors.surface,
  },
  rice: {
    backgroundColor: colors.surface,
  },
  side: {
    backgroundColor: colors.surface,
  },
  smallDish: {
    borderColor: colors.surface,
    borderRadius: 999,
    borderWidth: 3,
    height: 48,
    width: 48,
  },
  soup: {
    backgroundColor: colors.primarySoft,
  },
  tray: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 104,
    padding: spacing.md,
  },
});
