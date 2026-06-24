import React, { useEffect } from 'react';
import { Image, StyleSheet, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const logoSource = require('../../assets/wenever-symbol.png') as number;
const logoNativeWidth = 734;
const logoNativeHeight = 365;
const logoAspectRatio = logoNativeHeight / logoNativeWidth;
const logoAnimationDurationMs = 920;

interface BrandLogoProps {
  delay?: number;
  animated?: boolean;
  width?: number;
  style?: StyleProp<ImageStyle | ViewStyle>;
}

export function BrandLogo({ animated = false, delay = 0, width = 96, style }: BrandLogoProps) {
  const height = Math.round(width * logoAspectRatio);

  if (animated) {
    return <AnimatedBrandLogo delay={delay} height={height} style={style} width={width} />;
  }

  return (
    <Image
      accessibilityIgnoresInvertColors
      accessible={false}
      resizeMode="contain"
      source={logoSource}
      style={[styles.logo, { height, width }, style as StyleProp<ImageStyle>]}
    />
  );
}

function AnimatedBrandLogo({
  delay,
  height,
  style,
  width,
}: Required<Pick<BrandLogoProps, 'delay' | 'width'>> & { height: number; style?: BrandLogoProps['style'] }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: logoAnimationDurationMs,
        easing: Easing.bezier(0.18, 0.82, 0.24, 1),
      }),
    );
  }, [delay, progress]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.08, 1], [0, 1, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [5, 0], Extrapolation.CLAMP) }],
  }));
  const revealStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 0.94], [0, width], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[styles.animatedLogo, { height, width }, style as StyleProp<ViewStyle>, containerStyle]}>
      <Animated.View style={[styles.reveal, { height }, revealStyle]}>
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          resizeMode="contain"
          source={logoSource}
          style={[styles.logo, { height, width }]}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedLogo: {
    overflow: 'hidden',
  },
  logo: {
    display: 'flex',
  },
  reveal: {
    overflow: 'hidden',
  },
});
