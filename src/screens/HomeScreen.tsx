import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BellRing, CalendarDays, ChevronRight, ListChecks, MessageSquareText, Settings, Soup } from 'lucide-react-native';

import { Card } from '../components/Card';
import { BottomBannerAd } from '../components/RevenueAds';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionHeader } from '../components/SectionHeader';
import { colors, fonts, radii, spacing, typography } from '../theme';
import { useAppState } from '../state/AppStateContext';
import { clockTimeToMinutes, getCurrentClockMinutes } from '../utils/time';
import { formatGradeClass } from '../utils/profile';
import { getTodayTimetableDayOrNull, getTomorrowTimetableDayOrNull } from '../utils/timetable';

export function HomeScreen() {
  const { meal, notificationSettings, posts, profile, setActiveTab, timetable } = useAppState();
  const currentDay = getTodayTimetableDayOrNull();
  const tomorrowDay = getTomorrowTimetableDayOrNull();
  const todaySlots = currentDay
    ? timetable.slots.filter((slot) => slot.day === currentDay).sort((left, right) => left.period - right.period)
    : [];
  const tomorrowSlots = tomorrowDay
    ? timetable.slots.filter((slot) => slot.day === tomorrowDay).sort((left, right) => left.period - right.period)
    : [];
  const nowMinutes = getCurrentClockMinutes();
  const upcomingSlotIndex = todaySlots.findIndex((slot) => clockTimeToMinutes(slot.endTime, slot.startTime || '23:59') >= nowMinutes);
  const schoolOffToday = todaySlots.length === 0;
  const schoolDoneToday = !schoolOffToday && upcomingSlotIndex === -1;
  const showTomorrowTimetable = schoolDoneToday;
  const displaySlots = showTomorrowTimetable ? tomorrowSlots : todaySlots;
  const displayDayCopy = showTomorrowTimetable ? '내일' : '오늘';
  const todaySlotIndex = schoolOffToday ? -1 : Math.max(upcomingSlotIndex, 0);
  const nextSlotIndex = showTomorrowTimetable ? (tomorrowSlots.length ? 0 : -1) : todaySlotIndex;
  const nextSlot = nextSlotIndex >= 0 ? displaySlots[nextSlotIndex] : undefined;
  const nextSlotStarted = nextSlot
    && !showTomorrowTimetable
    ? clockTimeToMinutes(nextSlot.startTime) <= nowMinutes && nowMinutes < clockTimeToMinutes(nextSlot.endTime, nextSlot.startTime)
    : false;
  const latestPosts = posts
    .filter((post) => !post.hidden)
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
    .slice(0, 3);
  const schoolName = profile.schoolName.replace('서울시 ', '');
  const headerTitleCopy = '웨네버';
  const noClassCopy = `${displayDayCopy} 수업 없어요`;
  const noMealCopy = '급식 정보가 없어요';
  const hasMeal = meal.items.length > 0;
  const mealSummary = hasMeal ? meal.items.slice(0, 3).join(', ') : noMealCopy;
  const heroPeriodCopy = schoolOffToday ? '수업 없음' : schoolDoneToday ? (nextSlot ? '내일' : '수업 끝') : `${nextSlot?.period ?? 1}교시`;
  const heroTitleCopy = schoolOffToday
    ? noClassCopy
    : schoolDoneToday
      ? nextSlot
        ? '내일 첫 수업'
        : '오늘 수업 완료'
      : nextSlotStarted
        ? '수업 진행 중'
        : '수업 예정';
  const heroSubCopy = schoolOffToday
    ? '좋은 하루 보내세요.'
    : nextSlot
      ? `${nextSlot.subject} · ${nextSlot.startTime}`
      : '오늘 일정이 정리됐어요.';

  return (
    <Screen>
      <ScreenHeader
        action={
          <Pressable
            accessibilityLabel="설정"
            accessibilityRole="button"
            onPress={() => setActiveTab('settings')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <Settings color={colors.text} size={22} strokeWidth={2} />
          </Pressable>
        }
        subtitle={`${formatGradeClass(profile.grade, profile.className)} · ${schoolName}`}
        title={headerTitleCopy}
      />

      <Pressable
        accessibilityRole="button"
        onPress={() => setActiveTab('timetable')}
        style={({ pressed }) => [styles.heroCard, pressed && styles.heroCardPressed]}
      >
        <View style={styles.heroCopy}>
          <Text style={styles.heroPeriod}>{heroPeriodCopy}</Text>
          <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={2} style={styles.heroTitle}>
            {heroTitleCopy}
          </Text>
          <Text style={styles.heroSubcopy}>{heroSubCopy}</Text>
          {displaySlots.length ? (
            <View style={styles.progressTrack}>
              {displaySlots.slice(0, 6).map((slot, index) => (
                <View
                  key={slot.id}
                  style={[
                    styles.progressSegment,
                    index <= nextSlotIndex ? styles.progressSegmentActive : null,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.heroActionRow}>
          <View style={styles.heroActionButton}>
            <Text style={styles.heroActionText}>시간표 보기</Text>
            <CalendarDays color={colors.primary} size={18} />
          </View>
          <View style={styles.heroActionButton}>
            <Text style={styles.heroActionText}>오늘 요약</Text>
            <ListChecks color={colors.primary} size={18} />
          </View>
        </View>
      </Pressable>

      <Card style={styles.timetableCard}>
        <SectionHeader title={`${displayDayCopy} 시간표`} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.slotStrip}
        >
          {displaySlots.length ? (
            displaySlots.map((slot) => {
              const active = slot.id === nextSlot?.id;
              return (
                <Pressable
                  key={slot.id}
                  onPress={() => setActiveTab('timetable')}
                  style={({ pressed }) => [
                    styles.slotCard,
                    active ? styles.slotCardActive : null,
                    pressed && styles.slotCardPressed,
                  ]}
                >
                  <Text style={[styles.slotPeriod, active ? styles.slotPeriodActive : null]}>{slot.period}</Text>
                  <Text numberOfLines={1} style={[styles.slotSubject, active ? styles.slotSubjectActive : null]}>
                    {slot.subject}
                  </Text>
                  <Text style={[styles.slotTime, active ? styles.slotTimeActive : null]}>{slot.startTime}</Text>
                </Pressable>
              );
            })
          ) : (
            <View style={styles.emptyTodayBox}>
              <Text style={styles.emptyTodayText}>{displayDayCopy} 등록된 수업이 없어요.</Text>
            </View>
          )}
        </ScrollView>
      </Card>

      <Card style={styles.summaryCard}>
        <SectionHeader title="오늘 요약" />
        <SummaryRow
          Icon={Soup}
          accent={colors.primary}
          label="급식"
          onPress={() => setActiveTab('meal')}
          value={mealSummary}
        />
        <SummaryRow
          Icon={MessageSquareText}
          accent={colors.primary}
          label="게시판 최신글"
          onPress={() => setActiveTab('board')}
          value={latestPosts[0]?.title ?? '아직 새 글이 없어요'}
        />
        <SummaryRow
          Icon={BellRing}
          accent={colors.primary}
          label="알림"
          onPress={() => setActiveTab('settings')}
          value={notificationSettings.timetable ? '수업 알림 켜짐' : '수업 알림 꺼짐'}
        />
      </Card>

      <BottomBannerAd placement="home_bottom" />
    </Screen>
  );
}

function SummaryRow({
  Icon,
  accent,
  label,
  onPress,
  value,
}: {
  Icon: typeof Soup;
  accent: string;
  label: string;
  onPress: () => void;
  value: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}: ${value}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.summaryRow, pressed && styles.summaryRowPressed]}
    >
      <View style={styles.summaryIcon}>
        <Icon color={accent} size={20} strokeWidth={2} />
      </View>
      <View style={styles.summaryCopy}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.summaryValue}>
          {value}
        </Text>
      </View>
      <ChevronRight color={colors.subtle} size={17} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  emptyTodayBox: {
    alignItems: 'center',
    backgroundColor: colors.dividerSoft,
    borderRadius: radii.lg,
    justifyContent: 'center',
    minHeight: 92,
    paddingHorizontal: spacing.lg,
    width: 220,
  },
  emptyTodayText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  heroActionButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: 'rgba(255,255,255,0.4)',
    borderCurve: 'continuous',
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroActionText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    borderCurve: 'continuous',
    borderRadius: radii.xl,
    borderWidth: 1,
    boxShadow: '0 14px 28px rgba(49, 90, 77, 0.18)',
    minHeight: 194,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  heroCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  heroPeriod: {
    color: 'rgba(255,255,255,0.86)',
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '700',
  },
  heroCopy: {
    gap: spacing.xs,
  },
  heroSubcopy: {
    color: 'rgba(255,255,255,0.88)',
    fontFamily: fonts.regular,
    fontSize: typography.body,
    fontWeight: '500',
    marginTop: spacing.xs,
  },
  heroTitle: {
    color: colors.surface,
    fontFamily: fonts.semibold,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 29,
    marginTop: spacing.sm,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  iconButtonPressed: {
    backgroundColor: colors.surfacePressed,
    transform: [{ scale: 0.97 }],
  },
  notificationDot: {
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: 5,
    borderWidth: 2,
    height: 11,
    position: 'absolute',
    right: 10,
    top: 10,
    width: 11,
  },
  progressSegment: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: radii.pill,
    flex: 1,
    height: 5,
  },
  progressSegmentActive: {
    backgroundColor: colors.surface,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  slotCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 78,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    width: 76,
  },
  slotCardActive: {
    backgroundColor: colors.surface,
    borderColor: colors.primaryTint,
    borderWidth: 1,
  },
  slotCardPressed: {
    opacity: 0.78,
  },
  slotPeriod: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  slotPeriodActive: {
    color: colors.primary,
  },
  slotStrip: {
    gap: spacing.sm,
    paddingRight: spacing.xs,
  },
  slotSubject: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: spacing.sm,
    maxWidth: 64,
    textAlign: 'center',
  },
  slotSubjectActive: {
    color: colors.text,
  },
  slotTime: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    marginTop: 'auto',
  },
  slotTimeActive: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontWeight: '600',
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  summaryLabel: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 20,
  },
  summaryCard: {
    paddingBottom: spacing.sm,
  },
  summaryIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  summaryRow: {
    alignItems: 'center',
    borderTopColor: colors.dividerSoft,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  summaryRowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  summaryValue: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 20,
  },
  timetableCard: {
    paddingBottom: spacing.lg,
  },
});
