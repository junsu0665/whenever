import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing, typography } from '../theme';
import { hapticToggle } from '../utils/haptics';

interface ToggleRowProps {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function ToggleRow({ title, description, value, onValueChange }: ToggleRowProps) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: value ? 1 : 0,
      friction: 9,
      tension: 170,
      useNativeDriver: false,
    }).start();
  }, [progress, value]);

  const handleToggle = () => {
    const nextValue = !value;
    hapticToggle(nextValue);
    onValueChange(nextValue);
  };

  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={title}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={handleToggle}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Animated.View
        style={[
          styles.switchTrack,
          {
            backgroundColor: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [colors.dividerSoft, colors.primary],
            }),
            borderColor: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['rgba(255,255,255,0)', colors.primaryDark],
            }),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.switchThumb,
            {
              transform: [
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 16] }) },
                { scale: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.94, 1] }) },
              ],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
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
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  rowPressed: {
    opacity: 0.82,
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
    boxShadow: '0 1px 2px rgba(14, 21, 17, 0.10)',
    height: 20,
    width: 20,
  },
  switchTrack: {
    borderColor: 'transparent',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    padding: 2,
    width: 42,
  },
});
