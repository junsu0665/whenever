import React, { useEffect } from 'react';
import { RefreshCw } from 'lucide-react-native';
import { Platform } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface RefreshGlyphProps {
  active?: boolean;
  color: string;
  size?: number;
}

export function RefreshGlyph({ active = false, color, size = 19 }: RefreshGlyphProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (active) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(1, Platform.OS === 'web' ? { duration: 980 } : { duration: 980, easing: Easing.linear }),
        -1,
      );
      return;
    }

    cancelAnimation(rotation);
    rotation.value = withTiming(0, Platform.OS === 'web' ? { duration: 120 } : { duration: 120, easing: Easing.out(Easing.quad) });
  }, [active, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 360}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <RefreshCw color={color} size={size} />
    </Animated.View>
  );
}
