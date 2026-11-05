import { strings } from '@/i18n';

import { formatVND } from './money';

/** The evening summary the phone shows by itself, set up in advance because the app is not running then. */
export type ReminderSettings = { enabled: boolean; hour: number; minute: number };

export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 21, minute: 0 };

/** Days set up ahead, so the reminder keeps coming for a while when the app is not opened. */
export const REMINDER_DAYS = 14;

export type DayTotals = { date: string; count: number; income: number; expense: number };

/** The next `count` times the reminder goes off, skipping today if its time has passed. */
export function reminderTimes(
  { hour, minute }: Pick<ReminderSettings, 'hour' | 'minute'>,
  now: Date,
  count = REMINDER_DAYS
): Date[] {
  const times: Date[] = [];
  for (let day = 0; times.length < count; day++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour, minute);
    if (at > now) times.push(at);
  }
  return times;
}

/**
 * The text for one day. With a PIN set the amounts stay out of it, because
 * notifications can show on the lock screen.
 */
export function reminderText(totals: DayTotals | undefined, hideAmounts: boolean): { title: string; body: string } {
  const t = strings().reminder;
  if (!totals || totals.count === 0) return { title: t.titleEmpty, body: t.empty };
  const { count, income, expense } = totals;
  if (hideAmounts) return { title: t.titleSummary, body: t.countOnly(count) };
  return {
    title: t.titleSummary,
    body:
      income > 0
        ? t.summaryWithIncome(formatVND(income), formatVND(expense), count)
        : t.summary(formatVND(expense), count),
  };
}

export function formatReminderTime({ hour, minute }: Pick<ReminderSettings, 'hour' | 'minute'>): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
