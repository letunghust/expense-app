import {
  daysInMonth,
  formatDate,
  formatDayHeader,
  formatMonth,
  fromISODate,
  monthRange,
  shiftMonth,
  toISODate,
} from '../dates';

describe('dates', () => {
  test('ISO round trip uses local dates', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toISODate(fromISODate('2026-10-27'))).toBe('2026-10-27');
  });

  test('shiftMonth wraps years', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 5 }, -17)).toEqual({ year: 2024, month: 12 });
  });

  test('monthRange is half open', () => {
    expect(monthRange({ year: 2026, month: 12 })).toEqual({ start: '2026-12-01', end: '2027-01-01' });
  });

  test('daysInMonth handles leap years', () => {
    expect(daysInMonth({ year: 2024, month: 2 })).toBe(29);
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
  });

  test('formatting', () => {
    expect(formatMonth({ year: 2026, month: 10 })).toBe('Tháng 10/2026');
    expect(formatDate('2026-10-27')).toBe('27/10/2026');
  });

  test('formatDayHeader', () => {
    expect(formatDayHeader('2026-10-27', '2026-10-27')).toBe('Hôm nay');
    expect(formatDayHeader('2026-10-26', '2026-10-27')).toBe('Hôm qua');
    expect(formatDayHeader('2026-02-28', '2026-03-01')).toBe('Hôm qua');
    expect(formatDayHeader('2026-10-25', '2026-10-27')).toBe('Chủ nhật, 25/10/2026');
  });
});
