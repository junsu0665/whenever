import React, { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';

import { colors, spacing } from '../theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  backgroundColor?: string;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({ children, scroll = true, backgroundColor, contentStyle }: ScreenProps) {
  const containerStyle = [styles.container, backgroundColor ? { backgroundColor } : null];
  const entering = Platform.OS === 'web' ? FadeIn.duration(170) : FadeIn.duration(170).easing(Easing.out(Easing.quad));

  if (!scroll) {
    return (
      <Animated.View
        entering={entering}
        style={containerStyle}
      >
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, contentStyle]}
      entering={entering}
      keyboardShouldPersistTaps="always"
      showsVerticalScrollIndicator={false}
      style={containerStyle}
    >
      {children}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    gap: spacing.md,
    maxWidth: 508,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 124,
    width: '100%',
  },
});
