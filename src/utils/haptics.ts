import * as Haptics from 'expo-haptics';

type ImpactWeight = 'light' | 'medium' | 'heavy';
type NotificationTone = 'success' | 'warning' | 'error';
type ButtonIntent = 'primary' | 'secondary' | 'danger';

const impactStyleByWeight: Record<ImpactWeight, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};

const notificationTypeByTone: Record<NotificationTone, Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

const canUseHaptics = process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android';

function runHaptic(task: () => Promise<void>) {
  if (!canUseHaptics) {
    return;
  }

  void task().catch(() => undefined);
}

function runHapticSequence(tasks: Array<() => Promise<void>>, gapMs = 54) {
  if (!canUseHaptics) {
    return;
  }

  tasks.forEach((task, index) => {
    setTimeout(() => {
      void task().catch(() => undefined);
    }, index * gapMs);
  });
}

export function hapticSelection() {
  runHaptic(() => Haptics.selectionAsync());
}

export function hapticImpact(weight: ImpactWeight = 'light') {
  runHaptic(() => Haptics.impactAsync(impactStyleByWeight[weight]));
}

export function hapticNotification(tone: NotificationTone) {
  runHaptic(() => Haptics.notificationAsync(notificationTypeByTone[tone]));
}

export function hapticButton(intent: ButtonIntent = 'primary') {
  if (intent === 'danger') {
    hapticImpact('medium');
    return;
  }

  if (intent === 'secondary') {
    hapticSelection();
    return;
  }

  hapticImpact('light');
}

export function hapticToggle(enabled: boolean) {
  if (enabled) {
    runHapticSequence([
      () => Haptics.selectionAsync(),
      () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    ]);
    return;
  }

  hapticImpact('light');
}

export function hapticSuccess() {
  runHapticSequence([
    () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  ], 70);
}

export function hapticWarning() {
  runHapticSequence([
    () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  ], 70);
}
