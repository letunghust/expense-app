import { DEFAULT_REMINDER, type ReminderSettings } from '@/lib/daily-reminder';

/** A web app can't schedule notifications on the device: that would need a server sending Web Push. */
export const REMINDER_SUPPORTED = false;

export async function loadReminderSettings(): Promise<ReminderSettings> {
  return DEFAULT_REMINDER;
}
export async function saveReminderSettings(_settings: ReminderSettings): Promise<void> {}
export async function requestReminderPermission(): Promise<boolean> {
  return false;
}
export async function rescheduleReminders(_db: unknown, _hideAmounts: boolean): Promise<void> {}
export function listenForOpenedReminder(_open: (route: '/transaction/new') => void): () => void {
  return () => {};
}
