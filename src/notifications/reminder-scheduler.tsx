import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useDataVersion } from '@/db/data-context';
import { useI18n } from '@/i18n';
import { useAppLock } from '@/lock/app-lock-context';

import { listenForOpenedReminder, REMINDER_SUPPORTED, rescheduleReminders } from './daily-reminder';

/**
 * Keeps the scheduled reminders in step with the data, settings and language,
 * and opens the form when one is tapped. Inside the lock gate: the tree is
 * unmounted while locked, so a tap waits for the unlock.
 */
export function ReminderScheduler() {
  const db = useSQLiteContext();
  const version = useDataVersion();
  const { language } = useI18n();
  const { settings } = useAppLock();

  useEffect(() => {
    if (!REMINDER_SUPPORTED) return;
    const reschedule = () =>
      rescheduleReminders(db, settings.pinEnabled).catch((error) => console.warn('Could not schedule reminders', error));
    reschedule();
    // The app can stay open across midnight: coming back extends the days set up ahead.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reschedule();
    });
    return () => subscription.remove();
  }, [db, version, language, settings.pinEnabled]);

  useEffect(() => listenForOpenedReminder((route) => router.navigate(route)), []);

  return null;
}
