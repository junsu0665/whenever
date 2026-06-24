import React, { ReactNode, useRef } from 'react';
import { Animated, Platform, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { colors, fonts, radii, spacing, typography } from '../theme';
import { hapticButton } from '../utils/haptics';

const canUseNativeDriver = Platform.OS !== 'web';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({ label, onPress, icon, disabled, variant = 'primary', style }: PrimaryButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const animateScale = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      friction: 9,
      tension: 180,
      useNativeDriver: canUseNativeDriver,
    }).start();
  };
  const handlePress = () => {
    hapticButton(variant);
    onPress();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        hitSlop={4}
        onPress={handlePress}
        onPressIn={() => !disabled && animateScale(0.95)}
        onPressOut={() => !disabled && animateScale(1)}
        style={({ pressed }) => [
          styles.button,
          styles[variant],
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        {icon}
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.86}
          numberOfLines={1}
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
    minHeight: 46,
    paddingHorizontal: spacing.lg,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.border,
    borderWidth: 1,
  },
  dangerLabel: {
    color: colors.danger,
  },
  disabled: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    boxShadow: 'none',
  },
  disabledLabel: {
    color: colors.disabled,
  },
  label: {
    color: colors.surface,
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.92,
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderWidth: 1,
    boxShadow: 'none',
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  secondaryLabel: {
    color: colors.text,
  },
});
