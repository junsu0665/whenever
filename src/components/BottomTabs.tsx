import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { BarChart3, CalendarDays, Home, MessageSquareText, Shield, Soup } from 'lucide-react-native';

import { colors, fonts, radii, spacing, typography } from '../theme';
import { TabKey } from '../types';
import { hapticSelection } from '../utils/haptics';

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
  const handlePress = () => {
    if (!active) {
      hapticSelection();
    }
    onPress();
  };

  useEffect(() => {
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      friction: 7,
      tension: 160,
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      hitSlop={6}
      onPress={handlePress}
      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
    >
      <Animated.View
        style={[
          styles.iconWrap,
          active && styles.iconWrapActive,
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
      <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: 0,
    borderTopWidth: 1,
    boxShadow: 'none',
    flexDirection: 'row',
    maxWidth: 540,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    width: '100%',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: radii.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  iconWrapActive: {
    backgroundColor: colors.primarySoft,
  },
  label: {
    color: colors.subtle,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '600',
    marginTop: 2,
  },
  labelActive: {
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontWeight: '600',
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 56,
    outlineColor: 'transparent',
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  tabPressed: {
    opacity: 0.78,
  },
});
