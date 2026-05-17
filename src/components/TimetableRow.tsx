import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing, typography } from '../theme';
import { TimetableSlot } from '../types';

interface TimetableRowProps {
  slot: TimetableSlot;
  compact?: boolean;
}

export function TimetableRow({ slot, compact }: TimetableRowProps) {
  return (
    <View style={[styles.row, compact && styles.compact]}>
      <View style={[styles.period, { backgroundColor: slot.color }]}>
        <Text style={styles.periodLabel}>{slot.period}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.subject}>{slot.subject}</Text>
        <Text style={styles.meta}>
          {slot.startTime} ~ {slot.endTime} · {slot.room}
        </Text>
      </View>
      <Text style={styles.teacher}>{slot.teacher}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    paddingVertical: spacing.sm,
  },
  copy: {
    flex: 1,
  },
  meta: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19,
    marginTop: 2,
  },
  period: {
    alignItems: 'center',
    borderRadius: radii.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  periodLabel: {
    color: colors.surface,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.dividerSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.md,
  },
  subject: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  teacher: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    fontWeight: '400',
  },
});
