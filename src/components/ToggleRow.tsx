import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing, typography } from '../theme';

interface ToggleRowProps {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function ToggleRow({ title, description, value, onValueChange }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        onPress={() => onValueChange(!value)}
        style={[styles.switchTrack, value && styles.switchTrackOn]}
      >
        <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  description: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  row: {
    alignItems: 'center',
    borderTopColor: colors.dividerSoft,
    borderTopWidth: 1,
    flexDirection: 'row',
    minHeight: 68,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  switchThumb: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    boxShadow: '0 2px 7px rgba(23, 32, 42, 0.16)',
    height: 22,
    width: 22,
  },
  switchThumbOn: {
    transform: [{ translateX: 18 }],
  },
  switchTrack: {
    backgroundColor: colors.dividerSoft,
    borderColor: 'transparent',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    padding: 2,
    width: 46,
  },
  switchTrackOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
