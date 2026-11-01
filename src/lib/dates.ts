import { strings } from '@/i18n';

/**
 * Dates are stored as local "YYYY-MM-DD" strings. They sort correctly as text
 * and avoid timezone shifts that come with storing timestamps. Display
 * formats follow the app language.
 */

export type YearMonth = { year: number; month: number }; // month is 1-12

const pad = (n: number) => n.toString().padStart(2, '0');

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function currentYearMonth(now = new Date()): YearMonth {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Half-open range [start, end) covering the whole month, for SQL `date >= ? AND date < ?`. */
export function monthRange(ym: YearMonth): { start: string; end: string } {
  const next = shiftMonth(ym, 1);
  return {
    start: `${ym.year}-${pad(ym.month)}-01`,
    end: `${next.year}-${pad(next.month)}-01`,
  };
}

export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(year, month, 0).getDate();
}

export function isSameMonth(a: YearMonth, b: YearMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

/** "Tháng 10/2026", "October 2026", "2026年10月"… */
export function formatMonth({ year, month }: YearMonth): string {
  return strings().format.month(month, year);
}

/** "2026-10-27" -> "27/10/2026" in Vietnamese, "2026/10/27" in Japanese… */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return strings().format.date(d, m, y);
}

/** "2026-10-27" -> "27/10/2026" in every language, for files such as the CSV export. */
export function formatDateDMY(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Section header for a day in the transaction list: "Hôm nay", "Hôm qua" or "Thứ hai, 26/10/2026". */
export function formatDayHeader(iso: string, today = todayISO()): string {
  const format = strings().format;
  if (iso === today) return format.today;
  const yesterday = fromISODate(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === toISODate(yesterday)) return format.yesterday;
  return format.dayHeader(format.weekdays[fromISODate(iso).getDay()], formatDate(iso));
}
