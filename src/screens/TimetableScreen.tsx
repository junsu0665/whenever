import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Camera, ChevronDown, ChevronUp, Clock3, Plus, Settings, Trash2 } from 'lucide-react-native';

import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PrimaryButton } from '../components/PrimaryButton';
import { BottomBannerAd, NativeAdCard } from '../components/RevenueAds';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionHeader } from '../components/SectionHeader';
import { colors, fonts, radii, spacing, typography } from '../theme';
import { useAppState } from '../state/AppStateContext';
import { Timetable, TimetableDay, TimetableSlot } from '../types';
import { hapticSelection, hapticWarning } from '../utils/haptics';
import { animateNextLayout } from '../utils/motion';
import {
  getCourseId,
  getSubjectColor,
  getTodayTimetableDay,
  getTimetablePeriodTime,
  timetableDays,
} from '../utils/timetable';

type TimetableView = 'edit' | 'full';

export function TimetableScreen() {
  const {
    addTimetableSlot,
    deleteTimetableSlot,
    importTimetableFromImage,
    setActiveTab,
    timetable,
    updateTimetableSlot,
  } = useAppState();
  const [view, setView] = useState<TimetableView>('full');
  const [selectedDay, setSelectedDay] = useState<TimetableDay>(() => getTodayTimetableDay());
  const [importExpanded, setImportExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualPeriod, setManualPeriod] = useState('1');
  const [manualSubject, setManualSubject] = useState('');
  const [manualTeacher, setManualTeacher] = useState('');
  const [manualRoom, setManualRoom] = useState('');
  const selectedDaySlots = timetable.slots.filter((slot) => slot.day === selectedDay).sort((left, right) => left.period - right.period);
  const selectedDayDate = getDateForTimetableDay(selectedDay);
  const todayDay = getTodayTimetableDay();

  const pickTimetable = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('사진 접근 권한이 필요해요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      base64: true,
      mediaTypes: ['images'],
      quality: 0.86,
    });

    if (result.canceled) {
      return;
    }

    setImporting(true);
    try {
      const asset = result.assets[0];
      await importTimetableFromImage({
        uri: asset.uri,
        base64: asset.base64,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
      });
      setView('full');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '시간표를 읽지 못했어요.');
    } finally {
      setImporting(false);
    }
  };

  const submitManualSlot = () => {
    const period = Math.round(Number(manualPeriod));
    const subject = manualSubject.trim();
    if (!subject || !Number.isFinite(period) || period < 1 || period > 12) {
      hapticWarning();
      setError('수업명과 1~12 사이 교시를 입력해 주세요.');
      return;
    }

    const defaultTime = getTimetablePeriodTime(timetable, period);
    addTimetableSlot({
      id: `slot-manual-${selectedDay}-${period}-${Date.now()}`,
      day: selectedDay,
      period,
      startTime: defaultTime.startTime,
      endTime: defaultTime.endTime,
      subject,
      teacher: manualTeacher.trim() || '미확인',
      room: manualRoom.trim() || '미확인',
      courseId: getCourseId(subject),
      color: getSubjectColor(subject),
    });
    setManualSubject('');
    setManualTeacher('');
    setManualRoom('');
    setError(null);
  };

  return (
    <Screen>
      <ScreenHeader
        action={
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              animateNextLayout();
              setView((current) => (current === 'full' ? 'edit' : 'full'));
            }}
            style={({ pressed }) => [styles.headerPill, pressed && styles.headerPillPressed]}
          >
            <Text style={styles.headerPillText}>{view === 'full' ? '요일별' : '전체 시간표'}</Text>
          </Pressable>
        }
        subtitle={`${timetable.semesterLabel ?? '학기 미설정'} · ${timetable.slots.length}개 수업`}
        title="시간표"
      />

      <Pressable
        accessibilityRole="button"
        onPress={() => setActiveTab('settings')}
        style={({ pressed }) => [styles.settingsShortcut, pressed && styles.settingsShortcutPressed]}
      >
        <View style={styles.settingsShortcutIcon}>
          <Settings color={colors.primary} size={18} strokeWidth={2.2} />
        </View>
        <Text style={styles.settingsShortcutText}>시간표 설정</Text>
      </Pressable>

      {view === 'full' ? (
        <>
          <FullTimetablePage
            onSelectDay={(day) => {
              setSelectedDay(day);
              setView('edit');
            }}
            timetable={timetable}
          />
          <BottomBannerAd placement="timetable_bottom" />
        </>
      ) : (
        <>
          <Card>
            <SectionHeader action={<Clock3 color={colors.primary} size={22} />} title={`${selectedDay}요일 시간표`} />
            <Text style={styles.dayMeta}>
              {formatKoreanMonthDay(selectedDayDate)}
              {selectedDay === todayDay ? ' · 오늘' : ''} · {timetable.semesterLabel ?? '학기 미설정'}
            </Text>
            <View style={styles.daySelector}>
              {timetableDays.map((day) => {
                const active = day === selectedDay;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={day}
                    onPress={() => {
                      if (selectedDay !== day) {
                        hapticSelection();
                      }
                      setSelectedDay(day);
                      setEditingId(null);
                    }}
                    style={({ pressed }) => [styles.dayChip, active && styles.dayChipActive, pressed && !active && styles.dayChipPressed]}
                  >
                    <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
            {selectedDaySlots.length > 0 ? (
              selectedDaySlots.map((slot) => (
                <EditableSlot
                  editing={editingId === slot.id}
                  key={slot.id}
                  onDelete={() => deleteTimetableSlot(slot.id)}
                  onEdit={() => {
                    animateNextLayout();
                    setEditingId(editingId === slot.id ? null : slot.id);
                  }}
                  onUpdate={(patch) => updateTimetableSlot(slot.id, patch)}
                  slot={slot}
                />
              ))
            ) : (
              <EmptyState compact icon={<Clock3 color={colors.subtle} size={22} />} title="등록된 수업이 없어요." />
            )}
          </Card>

          <Card style={styles.importCard}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                animateNextLayout();
                setImportExpanded((current) => !current);
              }}
              style={({ pressed }) => [styles.importHeader, pressed && styles.importHeaderPressed]}
            >
              <View style={styles.importIcon}>
                <Camera color={colors.primary} size={19} strokeWidth={2} />
              </View>
              <View style={styles.importCopy}>
                <Text style={styles.importTitle}>시간표 사진으로 추가하기</Text>
                <Text style={styles.caption}>사진을 업로드하면 시간표를 자동으로 정리해 드려요.</Text>
              </View>
              {importExpanded ? <ChevronUp color={colors.muted} size={18} /> : <ChevronDown color={colors.muted} size={18} />}
            </Pressable>
            {importExpanded ? (
              <View style={styles.importExpanded}>
                <Pressable
                  accessibilityRole="button"
                  disabled={importing}
                  onPress={pickTimetable}
                  style={({ pressed }) => [styles.photoDropzone, pressed && !importing && styles.photoDropzonePressed]}
                >
                  {importing ? <ActivityIndicator color={colors.primary} /> : <Camera color={colors.text} size={27} />}
                  <Text style={styles.photoDropzoneTitle}>{importing ? '인식 중' : '사진 선택 또는 드래그'}</Text>
                  <Text style={styles.photoDropzoneMeta}>JPG, PNG · 최대 10MB</Text>
                </Pressable>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <NativeAdCard style={styles.captureAd} />
              </View>
            ) : null}
          </Card>

          <Card>
            <SectionHeader action={<Plus color={colors.primary} size={22} />} title="수업 직접 추가" />
            <View style={styles.manualGrid}>
              <TextInput
                keyboardType="number-pad"
                onChangeText={setManualPeriod}
                placeholder="교시"
                placeholderTextColor={colors.disabled}
                style={[styles.input, styles.periodInput]}
                value={manualPeriod}
              />
              <TextInput
                onChangeText={setManualSubject}
                placeholder="수업명"
                placeholderTextColor={colors.disabled}
                style={[styles.input, styles.manualSubjectInput]}
                value={manualSubject}
              />
            </View>
            <View style={styles.manualGrid}>
              <TextInput
                onChangeText={setManualTeacher}
                placeholder="교사"
                placeholderTextColor={colors.disabled}
                style={[styles.input, styles.manualHalfInput]}
                value={manualTeacher}
              />
              <TextInput
                onChangeText={setManualRoom}
                placeholder="교실"
                placeholderTextColor={colors.disabled}
                style={[styles.input, styles.manualHalfInput]}
                value={manualRoom}
              />
            </View>
            <PrimaryButton
              disabled={!manualSubject.trim()}
              icon={<Plus color={manualSubject.trim() ? colors.surface : colors.disabled} size={18} />}
              label={`${selectedDay}요일에 추가`}
              onPress={submitManualSlot}
              style={styles.manualButton}
            />
          </Card>

          <BottomBannerAd placement="timetable_bottom" />
        </>
      )}
    </Screen>
  );
}

function FullTimetablePage({
  onSelectDay,
  timetable,
}: {
  onSelectDay: (day: TimetableDay) => void;
  timetable: Timetable;
}) {
  const maxPeriod = Math.max(7, ...timetable.slots.map((slot) => slot.period));
  const periods = Array.from({ length: maxPeriod }, (_, index) => index + 1);
  const todayDay = getTodayTimetableDay();

  return (
    <Card style={styles.fullCard}>
      <SectionHeader title="전체 시간표" />
      <View style={styles.dayQuickGrid}>
        {timetableDays.map((day) => {
          const daySlots = timetable.slots.filter((slot) => slot.day === day).sort((left, right) => left.period - right.period);
          const active = day === todayDay;

          return (
            <Pressable
              accessibilityRole="button"
              key={day}
              onPress={() => onSelectDay(day)}
              style={({ pressed }) => [styles.dayQuickChip, active && styles.dayQuickChipActive, pressed && styles.dayOverviewRowPressed]}
            >
              <Text style={[styles.dayQuickText, active && styles.dayQuickTextActive]}>{day}</Text>
              <Text style={[styles.dayQuickMeta, active && styles.dayQuickTextActive]}>
                {active ? '오늘' : `${daySlots.length || 0}개`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.fullGridHeader}>
        <Text style={styles.fullGridTitle}>이번 주 한눈에 보기</Text>
        <Text style={styles.fullGridMeta}>{maxPeriod}교시까지 화면 안에 맞춰 보여줘요.</Text>
      </View>
      <View key={timetable.lastImportedAt ?? timetable.id} style={styles.grid}>
        <View style={styles.gridRow}>
          <View style={[styles.gridCell, styles.periodHeaderCell]}>
            <Text style={styles.gridHeaderText}>교시</Text>
          </View>
          {timetableDays.map((day) => (
            <Pressable
              key={day}
              onPress={() => onSelectDay(day)}
              style={({ pressed }) => [
                styles.gridCell,
                styles.dayHeaderCell,
                day === todayDay && styles.dayHeaderCellActive,
                pressed && styles.gridCellPressed,
              ]}
            >
              <Text style={[styles.gridHeaderText, day === todayDay && styles.gridHeaderTextActive]}>{day}</Text>
            </Pressable>
          ))}
        </View>
        {periods.map((period) => {
          const periodTime = getTimetablePeriodTime(timetable, period);
          return (
            <View key={period} style={styles.gridRow}>
              <View style={[styles.gridCell, styles.periodCell]}>
                <Text style={styles.periodNumber}>{period}</Text>
                <Text style={styles.periodTime}>{periodTime.startTime}</Text>
              </View>
              {timetableDays.map((day) => {
                const slot = timetable.slots.find((candidate) => candidate.day === day && candidate.period === period);
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={`${day}-${period}`}
                    onPress={() => onSelectDay(day)}
                    style={({ pressed }) => [
                      styles.gridCell,
                      styles.classCell,
                      slot && styles.classCellFilled,
                      day === todayDay && styles.classCellToday,
                      pressed && styles.gridCellPressed,
                    ]}
                  >
                    {slot ? (
                      <>
                        <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={2} style={styles.gridSubject}>
                          {slot.subject}
                        </Text>
                        <Text numberOfLines={1} style={styles.gridMeta}>
                          {slot.room}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.gridEmpty}>-</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function getDateForTimetableDay(day: TimetableDay, baseDate = new Date()) {
  const monday = new Date(baseDate);
  const currentDay = monday.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  monday.setDate(baseDate.getDate() + mondayOffset + timetableDays.indexOf(day));
  return monday;
}

function formatKoreanMonthDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}.${day}`;
}

function EditableSlot({
  editing,
  onDelete,
  onEdit,
  onUpdate,
  slot,
}: {
  editing: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onUpdate: (patch: Partial<TimetableSlot>) => void;
  slot: TimetableSlot;
}) {
  return (
    <View style={styles.slotWrap}>
      <Pressable onPress={onEdit} style={({ pressed }) => [styles.slotRow, pressed && styles.slotRowPressed]}>
        <View style={[styles.period, { backgroundColor: slot.color }]}>
          <Text style={styles.periodText}>{slot.period}</Text>
        </View>
        <View style={styles.slotCopy}>
          <Text style={styles.subject}>{slot.subject}</Text>
          <Text style={styles.meta}>
            {slot.startTime} ~ {slot.endTime} · {slot.room} · {slot.teacher}
          </Text>
        </View>
      </Pressable>

      {editing ? (
        <View style={styles.editGrid}>
          <TextInput
            onChangeText={(subject) => onUpdate({ subject })}
            placeholder="과목"
            placeholderTextColor={colors.disabled}
            style={styles.input}
            value={slot.subject}
          />
          <TextInput
            onChangeText={(teacher) => onUpdate({ teacher })}
            placeholder="교사"
            placeholderTextColor={colors.disabled}
            style={styles.input}
            value={slot.teacher}
          />
          <TextInput
            onChangeText={(room) => onUpdate({ room })}
            placeholder="교실"
            placeholderTextColor={colors.disabled}
            style={styles.input}
            value={slot.room}
          />
          <Pressable accessibilityRole="button" onPress={onDelete} style={styles.deleteSlotButton}>
            <Trash2 color={colors.danger} size={16} />
            <Text style={styles.deleteSlotText}>수업 삭제</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  autoSchedule: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  autoScheduleField: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: 120,
  },
  autoScheduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  autoScheduleLabel: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '600',
  },
  autoTimeInput: {
    width: '100%',
  },
  caption: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: 2,
  },
  captureAd: {
    marginTop: spacing.md,
  },
  classCell: {
    alignItems: 'stretch',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  classCellFilled: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.primaryTint,
  },
  classCellToday: {
    backgroundColor: colors.primarySoft,
  },
  dayChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    height: 34,
    justifyContent: 'center',
  },
  dayChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayChipPressed: {
    backgroundColor: colors.surfacePressed,
  },
  dayChipText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    fontWeight: '400',
  },
  dayChipTextActive: {
    color: colors.surface,
  },
  dayHeaderCell: {
    backgroundColor: colors.primarySoft,
    flex: 1,
    minWidth: 0,
  },
  dayHeaderCellActive: {
    backgroundColor: colors.primary,
  },
  daySelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  dayMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 19,
    marginTop: -spacing.xs,
  },
  dayOverviewBadge: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  dayOverviewBadgeActive: {
    backgroundColor: colors.primary,
  },
  dayOverviewCopy: {
    flex: 1,
    minWidth: 0,
  },
  dayOverviewDay: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '700',
  },
  dayOverviewDayActive: {
    color: colors.surface,
  },
  dayOverviewList: {
    gap: spacing.sm,
  },
  dayOverviewMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    marginTop: 2,
  },
  dayOverviewRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 58,
    paddingHorizontal: spacing.md,
  },
  dayOverviewRowActive: {
    backgroundColor: colors.surface,
    borderColor: colors.primaryTint,
  },
  dayOverviewRowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  dayOverviewTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  dayQuickChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    height: 48,
    justifyContent: 'center',
    minWidth: 0,
  },
  dayQuickChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayQuickGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  dayQuickMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 9,
    lineHeight: 11,
  },
  dayQuickText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '700',
  },
  dayQuickTextActive: {
    color: colors.surface,
  },
  deleteSlotButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  deleteSlotText: {
    color: colors.danger,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  durationInput: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    minHeight: 38,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
  },
  durationInputWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
  },
  durationUnit: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    paddingRight: spacing.md,
  },
  editGrid: {
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingLeft: 44,
  },
  emptyText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  friendAvatar: {
    alignItems: 'center',
    borderRadius: radii.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  friendAvatarText: {
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '700',
  },
  friendCopy: {
    flex: 1,
    minWidth: 0,
  },
  friendEmptyText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 19,
    paddingVertical: spacing.sm,
  },
  friendMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    marginTop: 2,
  },
  friendName: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  friendPanel: {
    borderTopColor: colors.dividerSoft,
    borderTopWidth: 1,
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  friendRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 62,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  friendSection: {
    gap: spacing.sm,
  },
  friendSectionTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '700',
  },
  fullCard: {
    paddingHorizontal: spacing.md,
  },
  fullGridHeader: {
    borderTopColor: colors.dividerSoft,
    borderTopWidth: 1,
    gap: 1,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  fullGridMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    lineHeight: 16,
  },
  fullGridTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '700',
  },
  grid: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    overflow: 'hidden',
    width: '100%',
  },
  gridCell: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    minHeight: 41,
    paddingHorizontal: 3,
    paddingVertical: 3,
  },
  gridEmpty: {
    color: colors.disabled,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    textAlign: 'center',
  },
  gridHeaderText: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontWeight: '600',
    textAlign: 'center',
  },
  gridHeaderTextActive: {
    color: colors.surface,
  },
  gridCellPressed: {
    backgroundColor: colors.surfacePressed,
  },
  gridMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 9,
    marginTop: 1,
    textAlign: 'center',
  },
  gridRow: {
    flexDirection: 'row',
  },
  gridSubject: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.body,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  settingsShortcut: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  settingsShortcutIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  settingsShortcutPressed: {
    backgroundColor: colors.surfacePressed,
  },
  settingsShortcutText: {
    color: colors.primaryDark,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '700',
  },
  headerPill: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  headerPillPressed: {
    backgroundColor: colors.surfacePressed,
  },
  headerPillText: {
    color: colors.primary,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '700',
  },
  importCard: {
    paddingVertical: spacing.md,
  },
  importCopy: {
    flex: 1,
    minWidth: 0,
  },
  importExpanded: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  importHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    outlineColor: 'transparent',
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  importHeaderPressed: {
    opacity: 0.78,
  },
  importIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  importTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '700',
  },
  manualButton: {
    marginTop: spacing.md,
  },
  manualGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  manualHalfInput: {
    flex: 1,
  },
  manualSubjectInput: {
    flex: 1,
  },
  meta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    marginTop: 2,
  },
  period: {
    alignItems: 'center',
    borderRadius: radii.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  periodCell: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    width: 38,
  },
  periodHeaderCell: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    width: 38,
  },
  periodNumber: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  periodText: {
    color: colors.surface,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  periodTime: {
    color: colors.subtle,
    fontFamily: fonts.regular,
    fontSize: 8,
    marginTop: 1,
  },
  periodInput: {
    width: 76,
  },
  periodTimeInput: {
    width: 80,
  },
  periodTimeInputs: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  periodTimeLabel: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    minWidth: 40,
  },
  periodTimeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  periodTimeRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  periodTimeSeparator: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  periodTimeValue: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.tiny,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    minWidth: 37,
    textAlign: 'center',
  },
  previewBlock: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  previewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewMeta: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  photoDropzone: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 132,
    padding: spacing.lg,
  },
  photoDropzoneMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 19,
  },
  photoDropzonePressed: {
    backgroundColor: colors.surfacePressed,
  },
  photoDropzoneTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  shareSummaryBox: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minHeight: 96,
    padding: spacing.md,
  },
  shareSummaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shareSummaryLabel: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    lineHeight: 16,
  },
  shareSummaryValue: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h3,
    fontWeight: '700',
  },
  slotCopy: {
    flex: 1,
  },
  slotRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  slotRowPressed: {
    opacity: 0.78,
  },
  slotWrap: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  reminderChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  reminderChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  reminderChipPressed: {
    backgroundColor: colors.surfacePressed,
  },
  reminderChipText: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
  },
  reminderChipTextActive: {
    color: colors.surface,
  },
  reminderChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    maxWidth: 220,
  },
  reminderSetting: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  settingCopy: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  settingDescription: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  settingTitle: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  settingBlock: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  subject: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
});
