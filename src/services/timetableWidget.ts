import { Platform } from 'react-native';

import { Profile, Timetable, TimetableSlot } from '../types';
import { sortTimetableSlots } from '../utils/timetable';

export const timetableWidgetAppGroup = 'group.com.wenever.app';
export const timetableWidgetKind = 'com.wenever.app.timetable';
export const timetableWidgetStorageKey = 'wenever.timetable.widget.v1';

interface TimetableWidgetPayload {
  schemaVersion: 1;
  generatedAt: string;
  profileName: string;
  schoolName: string;
  grade: number;
  className: string;
  semesterLabel: string;
  slots: TimetableWidgetSlotPayload[];
}

interface TimetableWidgetSlotPayload {
  id: string;
  day: TimetableSlot['day'];
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string;
  room: string;
  color: string;
}

function buildTimetableWidgetPayload(profile: Profile, timetable: Timetable): TimetableWidgetPayload {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    profileName: profile.name,
    schoolName: profile.schoolName,
    grade: profile.grade,
    className: profile.className,
    semesterLabel: timetable.semesterLabel ?? timetable.weekLabel,
    slots: sortTimetableSlots(timetable.slots).map((slot) => ({
      id: slot.id,
      day: slot.day,
      period: slot.period,
      startTime: slot.startTime,
      endTime: slot.endTime,
      subject: slot.subject,
      teacher: slot.teacher,
      room: slot.room,
      color: slot.color,
    })),
  };
}

export async function syncTimetableWidgetData(profile: Profile, timetable: Timetable) {
  if (Platform.OS !== 'ios') {
    return;
  }

  try {
    const { ExtensionStorage } = await import('@bacons/apple-targets');
    const storage = new ExtensionStorage(timetableWidgetAppGroup);
    storage.set(timetableWidgetStorageKey, JSON.stringify(buildTimetableWidgetPayload(profile, timetable)));
    ExtensionStorage.reloadWidget(timetableWidgetKind);
  } catch {
    return;
  }
}

export async function clearTimetableWidgetData() {
  if (Platform.OS !== 'ios') {
    return;
  }

  try {
    const { ExtensionStorage } = await import('@bacons/apple-targets');
    const storage = new ExtensionStorage(timetableWidgetAppGroup);
    storage.remove(timetableWidgetStorageKey);
    ExtensionStorage.reloadWidget(timetableWidgetKind);
  } catch {
    return;
  }
}
