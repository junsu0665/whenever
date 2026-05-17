import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bell, BellRing, ChevronRight, Clock3, MessageSquareText, Soup, Utensils } from 'lucide-react-native';

import { Card } from '../components/Card';
import { BottomBannerAd } from '../components/RevenueAds';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { colors, fonts, radii, spacing, typography } from '../theme';
import { useAppState } from '../state/AppStateContext';
import { formatGradeClass } from '../utils/profile';
import { getTodayTimetableDayOrNull } from '../utils/timetable';

export function HomeScreen() {
  const { meal, notificationSettings, posts, profile, setActiveTab, timetable } = useAppState();
  const currentDay = getTodayTimetableDayOrNull();
  const todaySlots = currentDay ? timetable.slots.filter((slot) => slot.day === currentDay) : [];
  const schoolOffToday = todaySlots.length === 0;
  const nextSlot = schoolOffToday ? undefined : todaySlots[2] ?? todaySlots[0];
  const nextSlotIndex = Math.max(
    todaySlots.findIndex((slot) => slot.id === nextSlot?.id),
    0,
  );
  const hotPosts = posts.filter((post) => !post.hidden).slice(0, 4);
  const schoolName = profile.schoolName.replace('서울시 ', '');
  const noClassCopy = '오늘 수업 없음';
  const noMealCopy = '급식 정보 없음';
  const hasMeal = meal.items.length > 0;
  const mealSummary = hasMeal ? meal.items.slice(0, 3).join(', ') : noMealCopy;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.brand}>웨네버</Text>
          <Text style={styles.headerMeta}>
            {formatGradeClass(profile.grade, profile.className)} · {schoolName}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setActiveTab('profile')} style={styles.iconButton}>
          <Bell color={notificationSettings.timetable ? colors.text : colors.disabled} size={23} strokeWidth={2.1} />
          {notificationSettings.timetable ? <View style={styles.notificationDot} /> : null}
        </Pressable>
      </View>

      <Pressable onPress={() => setActiveTab('timetable')} style={styles.heroCard}>
        <View style={styles.heroStatus}>
          <Text style={styles.heroPeriod}>{schoolOffToday ? '수업 없음' : `${nextSlot?.period ?? 1}교시`}</Text>
          <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={2} style={styles.heroTitle}>
            {schoolOffToday ? noClassCopy : `${notificationSettings.timetableReminderMinutes}분 전 알림`}
          </Text>
          {schoolOffToday ? (
            <View style={styles.dayOffSpacer} />
          ) : (
            <>
              <View style={styles.progressTrack}>
                {todaySlots.map((slot, index) => (
                  <View
                    key={slot.id}
                    style={[
                      styles.progressSegment,
                      index <= nextSlotIndex ? styles.progressSegmentActive : null,
                    ]}
                  />
                ))}
              </View>
              <View style={styles.heroTimeRow}>
                <Clock3 color="rgba(255,255,255,0.78)" size={15} />
                <Text style={styles.heroTime}>{nextSlot?.startTime ?? ''}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.nextClassBlock}>
          <View style={styles.nextLabelRow}>
            <Text style={styles.nextLabel}>{schoolOffToday ? '오늘' : '다음 수업'}</Text>
            {!schoolOffToday ? <ChevronRight color="rgba(255,255,255,0.72)" size={18} /> : null}
          </View>
          <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.nextSubject}>
            {schoolOffToday ? '시간표 확인' : nextSlot?.subject ?? '수업'}
          </Text>
          {!schoolOffToday ? (
            <>
              <Text style={styles.nextMeta}>
                {nextSlot?.period ?? 1}교시 · {nextSlot?.startTime ?? ''}
              </Text>
              <Text style={styles.nextRoom}>
                {nextSlot?.endTime ?? ''} · {nextSlot?.room ?? '교실'}
              </Text>
            </>
          ) : null}
        </View>
      </Pressable>

      <Card style={styles.timetableCard}>
        <SectionHeader title="오늘의 시간표" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.slotStrip}
        >
          {todaySlots.length ? (
            todaySlots.map((slot) => {
              const active = slot.id === nextSlot?.id;
              return (
                <Pressable
                  key={slot.id}
                  onPress={() => setActiveTab('timetable')}
                  style={[styles.slotCard, active ? styles.slotCardActive : null]}
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
              <Text style={styles.emptyTodayText}>오늘 등록된 수업이 없습니다.</Text>
            </View>
          )}
        </ScrollView>
      </Card>

      <View style={styles.summaryRail}>
        <SummaryTile
          Icon={Soup}
          accent={colors.primary}
          label="오늘 급식"
          onPress={() => setActiveTab('meal')}
          value={mealSummary}
        />
        <View style={styles.summaryDivider} />
        <SummaryTile
          Icon={MessageSquareText}
          accent={colors.primary}
          label="학교 게시판"
          onPress={() => setActiveTab('board')}
          value={`새 글 ${hotPosts.length}개`}
        />
        <View style={styles.summaryDivider} />
        <SummaryTile
          Icon={BellRing}
          accent={colors.primary}
          label="알림"
          onPress={() => setActiveTab('profile')}
          value={notificationSettings.community ? '켜짐' : '꺼짐'}
        />
      </View>

      <Card style={styles.boardCard}>
        <SectionHeader
          action={
            <Pressable onPress={() => setActiveTab('board')} style={styles.headerLink}>
              <Text style={styles.headerLinkText}>더보기</Text>
              <ChevronRight color={colors.muted} size={17} />
            </Pressable>
          }
          title="학교 게시판"
        />
        {hotPosts.map((post, index) => (
          <Pressable
            key={post.id}
            onPress={() => setActiveTab('board')}
            style={[styles.postRow, index === 0 ? styles.postRowFirst : null]}
          >
            <View style={[styles.postAccent, post.hot ? styles.postAccentHot : null]} />
            <View style={styles.postCopy}>
              <Text numberOfLines={1} style={styles.postTitle}>
                {post.title}
              </Text>
              <Text style={styles.postMeta}>
                {post.anonymousLabel} · 공감 {post.likeCount} · 댓글 {post.commentCount}
              </Text>
            </View>
          </Pressable>
        ))}
      </Card>

      <Card style={styles.mealCard}>
        <SectionHeader
          action={
            <Pressable onPress={() => setActiveTab('meal')} style={styles.headerLink}>
              <Text style={styles.headerLinkText}>자세히</Text>
              <ChevronRight color={colors.muted} size={17} />
            </Pressable>
          }
          title="오늘 급식"
        />
        <View style={styles.mealContent}>
          <View style={styles.mealIcon}>
            <Utensils color={colors.primary} size={28} strokeWidth={2.2} />
          </View>
          <View style={styles.mealCopy}>
            <Text numberOfLines={2} style={styles.mealSummary}>
              {hasMeal ? meal.items.join(', ') : noMealCopy}
            </Text>
            {hasMeal ? (
              <View style={styles.mealMetaRow}>
                <Text style={styles.mealCalorie}>{meal.calories}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Card>

      <BottomBannerAd placement="home_bottom" />
    </Screen>
  );
}

function SummaryTile({
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
    <Pressable onPress={onPress} style={styles.summaryTile}>
      <Icon color={accent} size={24} strokeWidth={2.1} />
      <View style={styles.summaryCopy}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text numberOfLines={2} style={styles.summaryValue}>
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boardCard: {
    paddingBottom: spacing.sm,
  },
  brand: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.brand,
    fontWeight: '700',
    letterSpacing: 0,
  },
  dayOffSpacer: {
    flex: 1,
  },
  emptyTodayBox: {
    alignItems: 'center',
    backgroundColor: colors.dividerSoft,
    borderRadius: radii.md,
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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  headerLink: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 32,
  },
  headerLinkText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  headerMeta: {
    color: colors.subtle,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderColor: 'transparent',
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    borderWidth: 0,
    boxShadow: '0 14px 28px rgba(67, 169, 158, 0.2)',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 172,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  heroDivider: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    width: 1,
  },
  heroPeriod: {
    color: 'rgba(255,255,255,0.86)',
    fontFamily: fonts.semibold,
    fontSize: typography.h3,
    fontWeight: '700',
  },
  heroStatus: {
    flex: 1.45,
    justifyContent: 'space-between',
  },
  heroTime: {
    color: 'rgba(255,255,255,0.78)',
    fontFamily: fonts.regular,
    fontSize: typography.small,
    fontWeight: '400',
  },
  heroTimeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  heroTitle: {
    color: colors.surface,
    fontFamily: fonts.semibold,
    fontSize: 29,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 34,
    marginTop: spacing.sm,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    borderWidth: 0,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  mealCalorie: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    fontWeight: '400',
  },
  mealCard: {
    marginBottom: spacing.xs,
  },
  mealContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  mealCopy: {
    flex: 1,
  },
  mealIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: 'transparent',
    borderRadius: radii.lg,
    borderWidth: 0,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  mealMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  mealOrigin: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  mealSummary: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h3,
    fontWeight: '600',
    lineHeight: 25,
  },
  nextClassBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  nextLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontFamily: fonts.regular,
    fontSize: typography.small,
    fontWeight: '400',
  },
  nextLabelRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
  },
  nextMeta: {
    color: 'rgba(255,255,255,0.88)',
    fontFamily: fonts.regular,
    fontSize: typography.body,
    fontWeight: '400',
    lineHeight: 25,
    marginTop: spacing.md,
  },
  nextRoom: {
    color: 'rgba(255,255,255,0.88)',
    fontFamily: fonts.regular,
    fontSize: typography.body,
    fontWeight: '400',
    marginTop: spacing.xs,
  },
  nextSubject: {
    color: colors.surface,
    fontFamily: fonts.semibold,
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 28,
    marginTop: spacing.md,
  },
  notificationDot: {
    backgroundColor: colors.primaryTint,
    borderColor: colors.surface,
    borderRadius: 5,
    borderWidth: 2,
    height: 11,
    position: 'absolute',
    right: 10,
    top: 10,
    width: 11,
  },
  postCopy: {
    flex: 1,
  },
  postMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    marginTop: 3,
  },
  postRow: {
    alignItems: 'center',
    borderTopColor: colors.dividerSoft,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 62,
    paddingVertical: spacing.md,
  },
  postRowFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  postAccent: {
    backgroundColor: colors.dividerSoft,
    borderRadius: radii.pill,
    height: 36,
    width: 5,
  },
  postAccentHot: {
    backgroundColor: colors.primary,
  },
  postTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 25,
  },
  progressSegment: {
    backgroundColor: 'rgba(255,255,255,0.28)',
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
    marginVertical: spacing.xl,
  },
  slotCard: {
    alignItems: 'center',
    backgroundColor: colors.dividerSoft,
    borderColor: 'transparent',
    borderRadius: radii.md,
    borderWidth: 0,
    minHeight: 92,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    width: 86,
  },
  slotCardActive: {
    backgroundColor: colors.primarySoft,
    borderColor: 'transparent',
    borderWidth: 0,
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
    marginTop: spacing.md,
    maxWidth: 70,
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
    alignItems: 'center',
    gap: 2,
  },
  summaryDivider: {
    backgroundColor: colors.dividerSoft,
    width: 1,
  },
  summaryLabel: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  summaryRail: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.lg,
    borderWidth: 1,
    boxShadow: '0 12px 28px rgba(23, 32, 42, 0.07)',
    flexDirection: 'row',
    minHeight: 92,
    overflow: 'hidden',
  },
  summaryTile: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  summaryValue: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
  },
  timetableCard: {
    paddingBottom: spacing.lg,
  },
});
