import React, { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, TextInput, TextStyle } from 'react-native';

import { colors, fonts, radii, spacing, typography } from '../theme';
import { normalizeClockTime } from '../utils/time';

interface TimeFieldProps {
  value: string;
  onCommit: (value: string) => void;
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
}

export function TimeField({ accessibilityLabel, onCommit, style, value }: TimeFieldProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    const nextValue = normalizeClockTime(draft, value);
    setDraft(nextValue);
    if (nextValue !== value) {
      onCommit(nextValue);
    }
  };

  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      keyboardType="numbers-and-punctuation"
      maxLength={5}
      onBlur={commit}
      onChangeText={setDraft}
      onSubmitEditing={commit}
      placeholder="08:40"
      placeholderTextColor={colors.disabled}
      returnKeyType="done"
      selectTextOnFocus
      style={[styles.input, style]}
      value={draft}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    minHeight: 42,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
  },
});
