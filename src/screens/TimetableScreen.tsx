import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Camera, Clock3, Edit3, Plus, Share2, Trash2 } from 'lucide-react-native';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { BottomBannerAd, NativeAdCard } from '../components/RevenueAds';
import { Screen } from '../components/Screen';
import { SegmentedControl } from '../components/SegmentedControl';
import { SectionHeader } from '../components/SectionHeader';
import { TimeField } from '../components/TimeField';
import { ToggleRow } from '../components/ToggleRow';
import { colors, fonts, radii, spacing, typography } from '../theme';
import { useAppState } from '../state/AppStateContext';
import { PeriodTime, Timetable, TimetableDay, TimetableSlot } from '../types';
import { getCourseId, getSubjectColor, getTimetablePeriodTime, getTodayTimetableDay, timetableDays } from '../utils/timetable';

type TimetableView = 'edit' | 'full';

const timetableViewSegments: Array<{ key: TimetableView; label: string }> = [
  { key: 'edit', label: '등록/수정' },
  { key: 'full', label: '전체' },
];

export function TimetableScreen() {
  const {
    addTimetableSlot,
    deleteTimetableSlot,
    importTimetableFromImage,
    notificationSettings,
    profile,
    setNotificationPreferences,
    setShareStatus,
    setTimetablePeriodTime,
    setTimetableSemester,
    timetable,
    updateTimetableSlot,
  } = useAppState();
  const [view, setView] = useState<TimetableView>('edit');
  const [selectedDay, setSelectedDay] = useState<TimetableDay>(getTodayTimetableDay());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [semesterDraft, setSemesterDraft] = useState(timetable.semesterLabel ?? '2026 1학기');
  const [manualPeriod, setManualPeriod] = useState('1');
  const [manualSubject, setManualSubject] = useState('');
  const [manualTeacher, setManualTeacher] = useState('');
  const [manualRoom, setManualRoom] = useState('');
  const selectedDaySlots = timetable.slots.filter((slot) => slot.day === selectedDay);
  const maxPeriod = Math.max(8, ...timetable.slots.map((slot) => slot.period));
  const periodSettings = Array.from({ length: maxPeriod }, (_, index) => index + 1);

  const pickTimetable = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('사진 접근 권한이 필요합니다.');
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
      setError(nextError instanceof Error ? nextError.message : '시간표 인식에 실패했습니다.');
    } finally {
      setImporting(false);
    }
  };

  const submitManualSlot = () => {
    const period = Math.round(Number(manualPeriod));
    const subject = manualSubject.trim();
    if (!subject || !Number.isFinite(period) || period < 1 || period > 12) {
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
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>시간표</Text>
          <Text style={styles.subtitle}>사진 등록 후 교시별 정보를 확인해 저장합니다.</Text>
        </View>
      </View>

      <SegmentedControl segments={timetableViewSegments} value={view} onChange={setView} />

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
            <SectionHeader title="자동 시간표 등록" />
            <PrimaryButton
              disabled={importing}
              icon={importing ? <ActivityIndicator color={colors.surface} /> : <Camera color={colors.surface} size={20} />}
              label={importing ? '인식 중' : '시간표 사진 업로드'}
              onPress={pickTimetable}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Text style={styles.caption}>
              마지막 등록: {timetable.lastImportedAt ? new Date(timetable.lastImportedAt).toLocaleString('ko-KR') : '아직 없음'}
            </Text>
            <NativeAdCard style={styles.captureAd} />
          </Card>

          <Card>
            <SectionHeader action={<Clock3 color={colors.primary} size={22} />} title={`${selectedDay}요일 시간표`} />
            <View style={styles.semesterRow}>
              <TextInput
                onBlur={() => setTimetableSemester(semesterDraft)}
                onChangeText={setSemesterDraft}
                placeholder="학기 라벨"
                placeholderTextColor={colors.disabled}
                style={styles.semesterInput}
                value={semesterDraft}
              />
            </View>
            <View style={styles.daySelector}>
              {timetableDays.map((day) => {
                const active = day === selectedDay;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={day}
                    onPress={() => {
                      setSelectedDay(day);
                      setEditingId(null);
                    }}
                    style={[styles.dayChip, active && styles.dayChipActive]}
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
                  onEdit={() => setEditingId(editingId === slot.id ? null : slot.id)}
                  onUpdate={(patch) => updateTimetableSlot(slot.id, patch)}
                  slot={slot}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>등록된 수업이 없습니다.</Text>
            )}
          </Card>

          <Card>
            <SectionHeader action={<Clock3 color={colors.primary} size={22} />} title="시간 설정" />
            <View style={styles.reminderSetting}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>수업 알림</Text>
                <Text style={styles.settingDescription}>수업 시작 몇 분 전에 받을지 선택합니다.</Text>
              </View>
              <ReminderMinuteChips
                onChange={(timetableReminderMinutes) => setNotificationPreferences({ timetableReminderMinutes })}
                value={notificationSettings.timetableReminderMinutes}
              />
            </View>
            <View style={styles.periodTimeList}>
              {periodSettings.map((period) => (
                <PeriodTimeRow
                  key={period}
                  onChange={(time) => setTimetablePeriodTime(period, time)}
                  period={period}
                  time={getTimetablePeriodTime(timetable, period)}
                />
              ))}
            </View>
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

          <Card>
            <SectionHeader action={<Share2 color={colors.primary} size={22} />} title="시간표 공개 설정" />
            <ToggleRow
              description="친구가 내 시간표와 겹치는 시간을 볼 수 있어요."
              onValueChange={(value) => setShareStatus('timetableShareStatus', value ? 'enabled' : 'disabled')}
              title="내 시간표 공유"
              value={profile.timetableShareStatus === 'enabled'}
            />
            <ToggleRow
              description="내가 친구의 공개 시간표를 볼 수 있어요."
              onValueChange={(value) => setShareStatus('friendTimetableViewStatus', value ? 'enabled' : 'disabled')}
              title="친구 시간표 보기"
              value={profile.friendTimetableViewStatus === 'enabled'}
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

  return (
    <Card style={styles.fullCard}>
      <SectionHeader title="전체 시간표" />
      <ScrollView
        horizontal
        key={timetable.lastImportedAt ?? timetable.id}
        showsHorizontalScrollIndicator={false}
        style={styles.gridScroller}
      >
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <View style={[styles.gridCell, styles.periodHeaderCell]}>
              <Text style={styles.gridHeaderText}>교시</Text>
            </View>
            {timetableDays.map((day) => (
              <Pressable key={day} onPress={() => onSelectDay(day)} style={[styles.gridCell, styles.dayHeaderCell]}>
                <Text style={styles.gridHeaderText}>{day}</Text>
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
                      style={[styles.gridCell, styles.classCell, slot && styles.classCellFilled, slot ? { borderLeftColor: slot.color } : null]}
                    >
                      {slot ? (
                        <>
                          <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={2} style={styles.gridSubject}>
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
      </ScrollView>
      <Text style={styles.caption}>요일이나 수업 칸을 누르면 해당 요일 수정 화면으로 이동합니다.</Text>
    </Card>
  );
}

function ReminderMinuteChips({ onChange, value }: { onChange: (value: number) => void; value: number }) {
  const options = [0, 5, 10, 15, 20, 30];
  const visibleOptions = options.includes(value) ? options : [...options, value].sort((left, right) => left - right);

  return (
    <View style={styles.reminderChips}>
      {visibleOptions.map((option) => {
        const active = option === value;
        return (
          <Pressable
            accessibilityRole="button"
            key={option}
            onPress={() => onChange(option)}
            style={[styles.reminderChip, active && styles.reminderChipActive]}
          >
            <Text style={[styles.reminderChipText, active && styles.reminderChipTextActive]}>
              {option === 0 ? '정시' : `${option}분 전`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PeriodTimeRow({
  onChange,
  period,
  time,
}: {
  onChange: (time: PeriodTime) => void;
  period: number;
  time: PeriodTime;
}) {
  return (
    <View style={styles.periodTimeRow}>
      <Text style={styles.periodTimeLabel}>{period}교시</Text>
      <View style={styles.periodTimeInputs}>
        <TimeField
          accessibilityLabel={`${period}교시 시작 시간`}
          onCommit={(startTime) => onChange({ ...time, startTime })}
          style={styles.periodTimeInput}
          value={time.startTime}
        />
        <Text style={styles.periodTimeSeparator}>~</Text>
        <TimeField
          accessibilityLabel={`${period}교시 종료 시간`}
          onCommit={(endTime) => onChange({ ...time, endTime })}
          style={styles.periodTimeInput}
          value={time.endTime}
        />
      </View>
    </View>
  );
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
      <Pressable onPress={onEdit} style={styles.slotRow}>
        <View style={[styles.period, { backgroundColor: slot.color }]}>
          <Text style={styles.periodText}>{slot.period}</Text>
        </View>
        <View style={styles.slotCopy}>
          <Text style={styles.subject}>{slot.subject}</Text>
          <Text style={styles.meta}>
            {slot.startTime} ~ {slot.endTime} · {slot.room} · {slot.teacher}
          </Text>
        </View>
        <Edit3 color={colors.muted} size={18} />
      </Pressable>

      {editing ? (
        <View style={styles.editGrid}>
          <TextInput
            onChangeText={(subject) => onUpdate({ subject })}
            placeholder="과목"
            style={styles.input}
            value={slot.subject}
          />
          <TextInput
            onChangeText={(teacher) => onUpdate({ teacher })}
            placeholder="교사"
            style={styles.input}
            value={slot.teacher}
          />
          <TextInput
            onChangeText={(room) => onUpdate({ room })}
            placeholder="교실"
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
  caption: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  captureAd: {
    marginTop: spacing.md,
  },
  classCell: {
    alignItems: 'stretch',
    justifyContent: 'center',
    width: 88,
  },
  classCellFilled: {
    backgroundColor: colors.surfaceAlt,
    borderLeftWidth: 3,
  },
  dayChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    height: 38,
    justifyContent: 'center',
  },
  dayChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
    width: 88,
  },
  daySelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
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
  fullCard: {
    paddingHorizontal: spacing.md,
  },
  grid: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gridCell: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    minHeight: 72,
    padding: spacing.sm,
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
    fontSize: typography.small,
    fontWeight: '600',
    textAlign: 'center',
  },
  gridMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.tiny,
    marginTop: spacing.xs,
  },
  gridRow: {
    flexDirection: 'row',
  },
  gridScroller: {
    marginTop: spacing.sm,
  },
  gridSubject: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.small,
    fontWeight: '600',
    lineHeight: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.body,
    minHeight: 44,
    paddingHorizontal: spacing.md,
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
    width: 48,
  },
  periodHeaderCell: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    width: 48,
  },
  periodNumber: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
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
    fontSize: 10,
    marginTop: 2,
  },
  periodInput: {
    width: 76,
  },
  periodTimeInput: {
    width: 80,
  },
  periodTimeInputs: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  periodTimeLabel: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
    minWidth: 52,
  },
  periodTimeList: {
    borderTopColor: colors.dividerSoft,
    borderTopWidth: 1,
  },
  periodTimeRow: {
    alignItems: 'center',
    borderBottomColor: colors.dividerSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 62,
    paddingVertical: spacing.sm,
  },
  periodTimeSeparator: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  semesterInput: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  semesterRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
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
    paddingBottom: spacing.lg,
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
  subject: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.body,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: typography.small,
    marginTop: spacing.xs,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: typography.h1,
    fontWeight: '600',
  },
});
