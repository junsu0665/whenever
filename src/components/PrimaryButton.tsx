import React, { ReactNode, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { colors, fonts, radii, spacing, typography } from '../theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
}

export function PrimaryButton({ label, onPress, icon, disabled, variant = 'primary', style }: PrimaryButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const animateScale = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      friction: 7,
      tension: 180,
      useNativeDriver: false,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => !disabled && animateScale(0.95)}
        onPressOut={() => !disabled && animateScale(1)}
        style={({ pressed }) => [styles.button, styles[variant], disabled && styles.disabled, pressed && !disabled && styles.pressed]}
      >
        {icon}
        <Text
          style={[
            styles.label,
            variant === 'secondary' && styles.secondaryLabel,
            variant === 'danger' && styles.dangerLabel,
            disabled && styles.disabledLabel,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.xl,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: '#FFD5DA',
    borderWidth: 1,
  },
  dangerLabel: {
    color: colors.danger,
  },
  disabled: {
    backgroundColor: colors.dividerSoft,
  },
  disabledLabel: {
    color: colors.disabled,
  },
  label: {
    color: colors.surface,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.92,
  },
  primary: {
    backgroundColor: colors.primary,
    boxShadow: '0 10px 22px rgba(67, 169, 158, 0.22)',
  },
  secondary: {
    backgroundColor: colors.primarySoft,
    borderColor: '#CBECE6',
    borderWidth: 1,
  },
  secondaryLabel: {
    color: colors.primary,
  },
});
