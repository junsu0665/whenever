import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '../theme';

interface PillProps {
  label: string;
  tone?: 'primary' | 'warning' | 'danger' | 'blue' | 'neutral';
}

const toneMap = {
  primary: { backgroundColor: colors.primarySoft, color: colors.primary },
  warning: { backgroundColor: colors.warningSoft, color: colors.warning },
  danger: { backgroundColor: colors.dangerSoft, color: colors.danger },
  blue: { backgroundColor: colors.blueSoft, color: colors.blue },
  neutral: { backgroundColor: colors.surfaceAlt, color: colors.muted },
};

export function Pill({ label, tone = 'primary' }: PillProps) {
  const toneStyle = toneMap[tone];
  return (
    <View style={[styles.pill, { backgroundColor: toneStyle.backgroundColor }]}>
      <Text style={[styles.label, { color: toneStyle.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 25,
    paddingHorizontal: spacing.sm + 2,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    fontWeight: '600',
  },
});
