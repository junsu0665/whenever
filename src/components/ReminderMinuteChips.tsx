import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing, typography } from '../theme';
import { hapticSelection } from '../utils/haptics';

interface ReminderMinuteChipsProps {
  onChange: (value: number) => void;
  value: number;
}

export function ReminderMinuteChips({ onChange, value }: ReminderMinuteChipsProps) {
  const options = [0, 5, 10, 15, 20, 30];
  const visibleOptions = options.includes(value) ? options : [...options, value].sort((left, right) => left - right);

  return (
    <View style={styles.chips}>
      {visibleOptions.map((option) => {
        const active = option === value;
        return (
          <Pressable
            accessibilityRole="button"
            key={option}
            onPress={() => {
              if (!active) {
                hapticSelection();
              }
              onChange(option);
            }}
            style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && !active && styles.chipPressed]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {option === 0 ? '정시' : `${option}분 전`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  chipPressed: {
    opacity: 0.82,
  },
  chipText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.surface,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
