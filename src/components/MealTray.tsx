import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '../theme';

export function MealTray() {
  return (
    <View style={styles.tray}>
      <View style={[styles.dish, styles.rice]}>
        <View style={styles.riceGrain} />
      </View>
      <View style={[styles.dish, styles.soup]}>
        <View style={styles.soupRing} />
      </View>
      <View style={[styles.smallDish, styles.main]} />
      <View style={[styles.smallDish, styles.kimchi]} />
      <View style={[styles.smallDish, styles.side]} />
    </View>
  );
}

const styles = StyleSheet.create({
  dish: {
    alignItems: 'center',
    borderColor: colors.surface,
    borderRadius: 999,
    borderWidth: 3,
    height: 70,
    justifyContent: 'center',
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
  riceGrain: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 38,
    width: 38,
  },
  side: {
    backgroundColor: colors.warningSoft,
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
  soupRing: {
    backgroundColor: colors.primaryTint,
    borderRadius: 999,
    height: 34,
    opacity: 0.42,
    width: 34,
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
