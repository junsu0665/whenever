import * as Notifications from 'expo-notifications';

import { MealMenu, NotificationSettings, Timetable, TimetableDay, TimetableSlot } from '../types';
import { splitClockTime } from '../utils/time';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const notificationOwner = 'wenever';
let localNotificationScheduleSyncQueue: Promise<void> = Promise.resolve();

const weekdayToExpoNumber: Record<TimetableDay, number> = {
  월: 2,
  화: 3,
  수: 4,
  목: 5,
  금: 6,
};

export async function requestNotificationPermissions() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

async function hasNotificationPermission(requestPermission: boolean) {
  if (requestPermission) {
    return requestNotificationPermissions();
  }

  const current = await Notifications.getPermissionsAsync();
  return current.granted;
}

export async function getPushToken(requestPermission = true) {
  const granted = await hasNotificationPermission(requestPermission);
  if (!granted) {
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    const token = await Notifications.getDevicePushTokenAsync();
    return typeof token.data === 'string' ? token.data : JSON.stringify(token.data);
  }
}

function subtractMinutes(time: string, minutes: number) {
  const { hour: hourPart, minute: minutePart } = splitClockTime(time);
  const date = new Date();
  date.setHours(hourPart, minutePart, 0, 0);
  date.setMinutes(date.getMinutes() - minutes);

  return {
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

function getClassReminderContent(slot: TimetableSlot) {
  return {
    title: `${slot.period}교시 ${slot.subject}`,
    body: `${slot.startTime} 시작 · ${slot.room} · ${slot.teacher} 선생님`,
  };
}

function getTimetableReminderKey(slot: TimetableSlot, reminderMinutes: number) {
  const reminderTime = subtractMinutes(slot.startTime, reminderMinutes);
  const content = getClassReminderContent(slot);
  return JSON.stringify([slot.day, reminderTime.hour, reminderTime.minute, content.title, content.body]);
}

function uniqueTimetableReminderSlots(slots: TimetableSlot[], reminderMinutes: number) {
  const seen = new Set<string>();
  return slots.filter((slot) => {
    const key = getTimetableReminderKey(slot, reminderMinutes);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function formatMealNotificationItem(item: string) {
  return item
    .replace(/#/g, '')
    .replace(/\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMealReminderContent(meal: MealMenu) {
  const items = meal.items.map(formatMealNotificationItem).filter(Boolean);

  return {
    title: `오늘 ${meal.type} (${items.length}개)`,
    body: items.join('\n'),
  };
}

async function cancelWeneverScheduledNotifications() {
  const requests = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    requests
      .filter((request) => request.content.data?.owner === notificationOwner)
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
}

export async function scheduleClassReminder(slot: TimetableSlot, reminderMinutes = 10) {
  const granted = await requestNotificationPermissions();
  if (!granted) {
    return null;
  }

  const reminderTime = subtractMinutes(slot.startTime, reminderMinutes);
  const content = getClassReminderContent(slot);
  return Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      data: {
        owner: notificationOwner,
        slotId: slot.id,
        type: 'timetable',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: weekdayToExpoNumber[slot.day],
      hour: reminderTime.hour,
      minute: reminderTime.minute,
    },
  });
}

async function scheduleTimetableReminders(timetable: Timetable, reminderMinutes: number) {
  const slots = uniqueTimetableReminderSlots(timetable.slots, reminderMinutes).slice(0, 40);
  await Promise.all(
    slots.map((slot) => {
      const reminderTime = subtractMinutes(slot.startTime, reminderMinutes);
      const content = getClassReminderContent(slot);
      return Notifications.scheduleNotificationAsync({
        content: {
          title: content.title,
          body: content.body,
          data: {
            owner: notificationOwner,
            slotId: slot.id,
            type: 'timetable',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: weekdayToExpoNumber[slot.day],
          hour: reminderTime.hour,
          minute: reminderTime.minute,
        },
      });
    }),
  );
}

async function scheduleMealReminder(meal: MealMenu, settings: NotificationSettings) {
  if (!meal.items.length) {
    return;
  }

  const [year, month, day] = meal.date.split('-').map(Number);
  const reminderTime = splitClockTime(
    meal.type === '석식' ? settings.dinnerReminderTime : settings.lunchReminderTime,
    meal.type === '석식' ? '16:30' : '11:20',
  );
  const triggerDate = new Date(year, month - 1, day, reminderTime.hour, reminderTime.minute, 0, 0);
  if (triggerDate.getTime() <= Date.now()) {
    return;
  }

  const content = getMealReminderContent(meal);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      data: {
        owner: notificationOwner,
        mealDate: meal.date,
        mealType: meal.type,
        type: 'meal',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
}

async function runLocalNotificationScheduleSync(
  settings: NotificationSettings,
  timetable: Timetable,
  meal: MealMenu,
  requestPermission = false,
) {
  const granted = await hasNotificationPermission(requestPermission);
  if (!granted) {
    return false;
  }

  await cancelWeneverScheduledNotifications();
  if (settings.timetable) {
    await scheduleTimetableReminders(timetable, settings.timetableReminderMinutes);
  }
  if (settings.meal) {
    await scheduleMealReminder(meal, settings);
  }

  return true;
}

export function syncLocalNotificationSchedule(
  settings: NotificationSettings,
  timetable: Timetable,
  meal: MealMenu,
  requestPermission = false,
) {
  const sync = localNotificationScheduleSyncQueue.then(() =>
    runLocalNotificationScheduleSync(settings, timetable, meal, requestPermission),
  );
  localNotificationScheduleSyncQueue = sync.then(
    () => undefined,
    () => undefined,
  );
  return sync;
}
