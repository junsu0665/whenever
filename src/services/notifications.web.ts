import { MealMenu, NotificationSettings, Timetable, TimetableSlot } from '../types';

export async function requestNotificationPermissions() {
  return false;
}

export async function getPushToken() {
  return null;
}

export async function scheduleClassReminder(_slot: TimetableSlot, _reminderMinutes = 10) {
  return null;
}

export function syncLocalNotificationSchedule(
  _settings: NotificationSettings,
  _timetable: Timetable,
  _meal: MealMenu,
  _requestPermission = false,
) {
  return Promise.resolve(false);
}
