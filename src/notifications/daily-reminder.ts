import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { getDayTotals } from '@/db/repo';
import { strings } from '@/i18n';
import { toISODate } from '@/lib/dates';
import { DEFAULT_REMINDER, reminderText, reminderTimes, type ReminderSettings } from '@/lib/daily-reminder';
import { secureStorage } from '@/lib/secure-storage';

export const REMINDER_SUPPORTED = Platform.OS === 'android';

const CHANNEL_ID = 'daily-summary';
const SETTINGS_KEY = 'reminder.settings';
const FORM_ROUTE = '/transaction/new';

// A reminder that comes while the app is open still shows.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const stored = await secureStorage.getItem(SETTINGS_KEY);
    return stored ? { ...DEFAULT_REMINDER, ...JSON.parse(stored) } : DEFAULT_REMINDER;
  } catch (error) {
    console.warn('Could not read the reminder settings', error);
    return DEFAULT_REMINDER;
  }
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await secureStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function setUpChannel() {
  return Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: strings().reminder.channel,
    importance: AndroidImportance.DEFAULT,
  });
}

/** Asks Android for permission to show notifications; it only asks once a channel exists. */
export async function requestReminderPermission(): Promise<boolean> {
  await setUpChannel();
  if ((await Notifications.getPermissionsAsync()).granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

let latestRun = 0;

/**
 * Replaces the scheduled reminders with ones for the coming days, worded from
 * what is in the database now. Called whenever data or settings change, so
 * tonight's text is always current; a newer call takes over from an older one.
 */
export async function rescheduleReminders(db: SQLiteDatabase, hideAmounts: boolean): Promise<void> {
  const run = ++latestRun;
  const settings = await loadReminderSettings();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.enabled || run !== latestRun) return;

  await setUpChannel();
  const times = reminderTimes(settings, new Date());
  const last = times[times.length - 1];
  const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
  const totals = await getDayTotals(db, toISODate(times[0]), toISODate(end));
  for (const date of times) {
    if (run !== latestRun) return;
    const day = toISODate(date);
    await Notifications.scheduleNotificationAsync({
      identifier: `daily-${day}`,
      content: {
        ...reminderText(
          totals.find((row) => row.date === day),
          hideAmounts
        ),
        data: { url: FORM_ROUTE },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID },
    });
  }
}

/** Calls `open` when a reminder is tapped, also if that is what started the app. Returns how to stop listening. */
export function listenForOpenedReminder(open: (route: typeof FORM_ROUTE) => void): () => void {
  const opened = () => {
    open(FORM_ROUTE);
    Notifications.clearLastNotificationResponse();
  };
  if (Notifications.getLastNotificationResponse()?.notification) opened();
  const subscription = Notifications.addNotificationResponseReceivedListener(opened);
  return () => subscription.remove();
}
