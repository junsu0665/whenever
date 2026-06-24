import { LayoutAnimation, Platform, UIManager } from 'react-native';

let layoutAnimationReady = false;

export function animateNextLayout(duration = 240) {
  if (!layoutAnimationReady) {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
    layoutAnimationReady = true;
  }

  LayoutAnimation.configureNext({
    duration,
    create: {
      property: LayoutAnimation.Properties.opacity,
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    delete: {
      property: LayoutAnimation.Properties.opacity,
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
    },
  });
}
