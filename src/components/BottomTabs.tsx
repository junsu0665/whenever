import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { BarChart3, CalendarDays, Home, MessageSquareText, Shield, Soup, UserRound } from 'lucide-react-native';

import { colors, fonts, radii, spacing, typography } from '../theme';
import { TabKey } from '../types';

interface BottomTabsProps {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
  showAdmin?: boolean;
}

const appTabs: Array<{ key: TabKey; label: string; Icon: typeof Home }> = [
  { key: 'home', label: '홈', Icon: Home },
  { key: 'timetable', label: '시간표', Icon: CalendarDays },
  { key: 'board', label: '게시판', Icon: MessageSquareText },
  { key: 'meal', label: '급식', Icon: Soup },
  { key: 'grades', label: '성적', Icon: BarChart3 },
  { key: 'profile', label: '내정보', Icon: UserRound },
];

const adminTab: { key: TabKey; label: string; Icon: typeof Home } = { key: 'admin', label: '관리', Icon: Shield };

export function BottomTabs({ activeTab, onChange, showAdmin = false }: BottomTabsProps) {
  const tabs = showAdmin ? [...appTabs, adminTab] : appTabs;

  return (
    <View style={styles.container}>
      {tabs.map(({ key, label, Icon }) => (
        <TabButton
          Icon={Icon}
          active={key === activeTab}
          key={key}
          label={label}
          onPress={() => onChange(key)}
        />
      ))}
    </View>
  );
}

function TabButton({
  Icon,
  active,
  label,
  onPress,
}: {
  Icon: typeof Home;
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      friction: 7,
      tension: 160,
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  return (
    <Pressable accessibilityRole="tab" onPress={onPress} style={styles.tab}>
      <Animated.View
        style={[
          styles.iconWrap,
          {
            transform: [
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) },
            ],
          },
        ]}
      >
        <Icon color={active ? colors.primary : colors.subtle} size={21} strokeWidth={active ? 2.35 : 2} />
      </Animated.View>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.xl,
    borderWidth: 1,
    boxShadow: '0 -10px 28px rgba(23, 32, 42, 0.08)',
    flexDirection: 'row',
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 36,
  },
  label: {
    color: colors.subtle,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '600',
    marginTop: 3,
  },
  labelActive: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontWeight: '600',
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    outlineColor: 'transparent',
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
});
