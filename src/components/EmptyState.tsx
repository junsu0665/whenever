import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, fonts, radii, spacing, typography } from '../theme';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ compact = false, description, icon, style, title }: EmptyStateProps) {
  return (
    <View style={[styles.container, compact && styles.compact, style]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    minHeight: 72,
    paddingVertical: spacing.md,
  },
  container: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 104,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  description: {
    color: colors.subtle,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
    textAlign: 'center',
  },
  icon: {
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
});
