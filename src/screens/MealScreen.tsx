import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, Utensils } from 'lucide-react-native';

import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PrimaryButton } from '../components/PrimaryButton';
import { RefreshGlyph } from '../components/RefreshGlyph';
import { BottomBannerAd } from '../components/RevenueAds';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionHeader } from '../components/SectionHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { TimeField } from '../components/TimeField';
import { ToggleRow } from '../components/ToggleRow';
import { colors, fonts, radii, spacing, typography } from '../theme';
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

const allergenPattern = /\(([\d.,\s]+)\)/g;

function cleanMealItem(item: string) {
  return item
    .replace(/#/g, '')
    .replace(allergenPattern, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAllergenNumbers(items: string[]) {
  const numbers = items.flatMap((item) =>
    [...item.matchAll(allergenPattern)]
      .flatMap((match) => match[1].split(/[.,\s]+/))
      .filter(Boolean),
  );

  return [...new Set(numbers)].sort((left, right) => Number(left) - Number(right));
}

const mealTypeSegments: Array<{ key: MealMenu['type']; label: string }> = [
  { key: '중식', label: '중식' },
  { key: '석식', label: '석식' },
];

const emptyMealCopy = '등록된 식단이 없어요.';

export function MealScreen() {
  const { meal, notificationSettings, refreshMeal, setNotificationPreferences, setNotificationSetting } = useAppState();
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(meal.date || todayDate());
  const [selectedMealType, setSelectedMealType] = useState<MealMenu['type']>(meal.type);
  const cleanedItems = meal.items.map(cleanMealItem).filter(Boolean);
  const allergenNumbers = getAllergenNumbers(meal.items);

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
      <ScreenHeader subtitle={`${selectedDate} · ${selectedMealType}`} title="급식" />

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
            <View style={styles.mealIntro}>
              <View style={styles.mealIcon}>
                <Utensils color={colors.primary} size={21} strokeWidth={2} />
              </View>
              <View style={styles.mealIntroCopy}>
                <Text style={styles.mealIntroTitle}>식단</Text>
                <Text style={styles.mealIntroMeta}>{cleanedItems.length}개 메뉴</Text>
              </View>
            </View>
            <View style={styles.menuBox}>
              {cleanedItems.map((item) => (
                <View key={item} style={styles.menuRow}>
                  <View style={styles.menuDot} />
                  <Text style={styles.menuItem}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={styles.mealInfoGrid}>
              <View style={styles.mealInfoBox}>
                <Text style={styles.mealInfoLabel}>열량</Text>
                <Text style={styles.mealInfoValue}>{meal.calories || '정보 없음'}</Text>
              </View>
              <View style={styles.mealInfoBox}>
                <Text style={styles.mealInfoLabel}>알레르기</Text>
                {allergenNumbers.length ? (
                  <View style={styles.allergyChips}>
                    {allergenNumbers.map((number) => (
                      <View key={number} style={styles.allergyChip}>
                        <Text style={styles.allergyChipText}>{number}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.mealInfoValue}>표기 없음</Text>
                )}
              </View>
            </View>
          </>
        ) : (
          <EmptyState
            description="날짜나 식사 종류를 바꿔 다시 확인해 주세요."
            icon={<Utensils color={colors.subtle} size={24} />}
            style={styles.emptyMeal}
            title={emptyMealCopy}
          />
        )}
        <PrimaryButton
          icon={<RefreshGlyph active={loading} color={colors.surface} />}
          label="새로고침"
          onPress={syncMeal}
          style={styles.syncButton}
        />
      </Card>

      <Card>
        <SectionHeader action={<Bell color={colors.primary} size={22} />} title="급식 알림" />
        <ToggleRow
          description="설정한 시간에 급식 알림을 받아요."
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
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.dateButton, pressed && styles.dateButtonPressed]}>
      <Text style={styles.dateButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  allergyChip: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 26,
    justifyContent: 'center',
    minWidth: 26,
    paddingHorizontal: spacing.xs,
  },
  allergyChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  allergyChipText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '700',
  },
  dateButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    minHeight: 32,
    justifyContent: 'center',
  },
  dateButtonPressed: {
    backgroundColor: colors.surfacePressed,
  },
  dateButtonText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  dateControls: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  emptyMeal: {
    marginTop: spacing.md,
  },
  menuBox: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  menuDot: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 5,
    marginTop: 10,
    width: 5,
  },
  menuItem: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 23,
  },
  menuRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  mealIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  mealInfoBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minHeight: 72,
    minWidth: 132,
    padding: spacing.md,
  },
  mealInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  mealInfoLabel: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '700',
  },
  mealInfoValue: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 22,
  },
  mealIntro: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  mealIntroCopy: {
    flex: 1,
    minWidth: 0,
  },
  mealIntroMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    marginTop: 2,
  },
  mealIntroTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '700',
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
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  timeSettingTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
});
