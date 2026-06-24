import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing, typography } from '../theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function ScreenHeader({ action, subtitle, title }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
    marginTop: 2,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h1,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 34,
  },
});
