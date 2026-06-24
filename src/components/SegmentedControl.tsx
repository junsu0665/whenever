import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing, typography } from '../theme';
import { hapticSelection } from '../utils/haptics';

interface Segment<T extends string> {
  key: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ segments, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View style={styles.container}>
      {segments.map((segment) => {
        const active = segment.key === value;
        return (
          <SegmentButton
            active={active}
            key={segment.key}
            label={segment.label}
            onPress={() => {
              if (active) {
                return;
              }

              hapticSelection();
              onChange(segment.key);
            }}
          />
        );
      })}
    </View>
  );
}

function SegmentButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      friction: 9,
      tension: 170,
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={3}
      onPress={onPress}
      style={({ pressed }) => [styles.segment, pressed && !active && styles.segmentPressed]}
    >
      <Animated.View
        style={[
          styles.segmentFill,
          {
            backgroundColor: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['rgba(255,255,255,0)', colors.surface],
            }),
            borderColor: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['rgba(255,255,255,0)', colors.border],
            }),
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }],
          },
        ]}
      >
        <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: 4,
  },
  label: {
    color: colors.muted,
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelActive: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontWeight: '600',
  },
  segment: {
    flex: 1,
    minHeight: 34,
    minWidth: 0,
  },
  segmentPressed: {
    opacity: 0.76,
  },
  segmentFill: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderCurve: 'continuous',
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.xs,
  },
});
