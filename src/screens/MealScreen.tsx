import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, RefreshCcw, Utensils } from 'lucide-react-native';

import { Card } from '../components/Card';
import { MealTray } from '../components/MealTray';
import { PrimaryButton } from '../components/PrimaryButton';
import { BottomBannerAd } from '../components/RevenueAds';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { TimeField } from '../components/TimeField';
import { ToggleRow } from '../components/ToggleRow';
import { colors, fonts, spacing, typography } from '../theme';
import { useAppState } from '../state/AppStateContext';
import { MealMenu } from '../types';

const formatLocalDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const todayDate = () => formatLocalDate(new Date());

const shiftDate = (date: string, days: number) => {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return formatLocalDate(next);
};

const mealTypeSegments: Array<{ key: MealMenu['type']; label: string }> = [
  { key: '중식', label: '중식' },
  { key: '석식', label: '석식' },
];

const emptyMealCopy = '등록된 식단이 없습니다.';

export function MealScreen() {
  const { meal, notificationSettings, refreshMeal, setNotificationPreferences, setNotificationSetting } = useAppState();
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(meal.date || todayDate());
  const [selectedMealType, setSelectedMealType] = useState<MealMenu['type']>(meal.type);

  const syncMeal = async () => {
    setLoading(true);
    try {
      await refreshMeal(selectedDate, selectedMealType);
    } finally {
      setLoading(false);
    }
  };

  const loadMeal = async (date: string, mealType: MealMenu['type']) => {
    setSelectedDate(date);
    setSelectedMealType(mealType);
    setLoading(true);
    try {
      await refreshMeal(date, mealType);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>급식</Text>
        </View>
      </View>

      <Card>
        <SectionHeader action={<Utensils color={colors.primary} size={22} />} title={`${selectedMealType} · ${selectedDate}`} />
        <View style={styles.dateControls}>
          <DateButton label="전날" onPress={() => loadMeal(shiftDate(selectedDate, -1), selectedMealType)} />
          <DateButton label="오늘" onPress={() => loadMeal(todayDate(), selectedMealType)} />
          <DateButton label="다음날" onPress={() => loadMeal(shiftDate(selectedDate, 1), selectedMealType)} />
        </View>
        <SegmentedControl
          onChange={(mealType) => loadMeal(selectedDate, mealType)}
          segments={mealTypeSegments}
          value={selectedMealType}
        />
        {meal.items.length ? (
          <>
            <MealTray />
            <View style={styles.menuBox}>
              {meal.items.map((item) => (
                <Text key={item} style={styles.menuItem}>
                  {item}
                </Text>
              ))}
            </View>
            <Text style={styles.calorie}>{meal.calories || '열량 정보 없음'}</Text>
          </>
        ) : (
          <View style={styles.emptyMeal}>
            <Utensils color={colors.subtle} size={25} />
            <Text style={styles.emptyMealText}>{emptyMealCopy}</Text>
            <Text style={styles.emptyMealMeta}>NEIS 식단이 비어 있습니다.</Text>
          </View>
        )}
        <PrimaryButton
          icon={loading ? <ActivityIndicator color={colors.surface} /> : <RefreshCcw color={colors.surface} size={19} />}
          label={loading ? '확인 중' : '새로고침'}
          onPress={syncMeal}
          style={styles.syncButton}
        />
      </Card>

      <Card>
        <SectionHeader action={<Bell color={colors.primary} size={22} />} title="급식 알림" />
        <ToggleRow
          description="설정한 시간에 선택한 급식 알림을 받습니다."
          onValueChange={(value) => setNotificationSetting('meal', value)}
          title="급식 알림"
          value={notificationSettings.meal}
        />
        <View style={styles.timeSettingRow}>
          <View style={styles.timeSettingCopy}>
            <Text style={styles.timeSettingTitle}>중식 알림 시간</Text>
            <Text style={styles.timeSettingDescription}>오늘 중식 메뉴를 받을 시간</Text>
          </View>
          <TimeField
            accessibilityLabel="중식 알림 시간"
            onCommit={(lunchReminderTime) => setNotificationPreferences({ lunchReminderTime })}
            style={styles.timeInput}
            value={notificationSettings.lunchReminderTime}
          />
        </View>
        <View style={styles.timeSettingRow}>
          <View style={styles.timeSettingCopy}>
            <Text style={styles.timeSettingTitle}>석식 알림 시간</Text>
            <Text style={styles.timeSettingDescription}>석식 메뉴를 받을 시간</Text>
          </View>
          <TimeField
            accessibilityLabel="석식 알림 시간"
            onCommit={(dinnerReminderTime) => setNotificationPreferences({ dinnerReminderTime })}
            style={styles.timeInput}
            value={notificationSettings.dinnerReminderTime}
          />
        </View>
      </Card>

      <BottomBannerAd placement="meal_bottom" />
    </Screen>
  );
}

function DateButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.dateButton}>
      <Text style={styles.dateButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  calorie: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    fontWeight: '400',
    marginTop: spacing.md,
  },
  dateButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  dateButtonText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  dateControls: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  emptyMeal: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyMealMeta: {
    color: colors.subtle,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyMealText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 23,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  menuBox: {
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  menuItem: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h3,
    fontWeight: '600',
    lineHeight: 25,
  },
  syncButton: {
    marginTop: spacing.lg,
  },
  timeInput: {
    width: 92,
  },
  timeSettingCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  timeSettingDescription: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  timeSettingRow: {
    alignItems: 'center',
    borderTopColor: colors.dividerSoft,
    borderTopWidth: 1,
    flexDirection: 'row',
    minHeight: 68,
    paddingVertical: spacing.md,
  },
  timeSettingTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  title: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h1,
    fontWeight: '600',
  },
});
