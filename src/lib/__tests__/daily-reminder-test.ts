import { formatReminderTime, reminderText, reminderTimes } from '../daily-reminder';

describe('reminderTimes', () => {
  const at21 = { hour: 21, minute: 0 };

  test('starts today while the time is still ahead', () => {
    const times = reminderTimes(at21, new Date(2026, 10, 5, 20, 59), 3);
    expect(times).toEqual([new Date(2026, 10, 5, 21, 0), new Date(2026, 10, 6, 21, 0), new Date(2026, 10, 7, 21, 0)]);
  });

  test('starts tomorrow once the time has passed, also exactly at that time', () => {
    expect(reminderTimes(at21, new Date(2026, 10, 5, 21, 0), 1)).toEqual([new Date(2026, 10, 6, 21, 0)]);
    expect(reminderTimes(at21, new Date(2026, 10, 5, 23, 30), 1)).toEqual([new Date(2026, 10, 6, 21, 0)]);
  });

  test('crosses months and years', () => {
    expect(reminderTimes(at21, new Date(2026, 11, 31, 22, 0), 2)).toEqual([
      new Date(2027, 0, 1, 21, 0),
      new Date(2027, 0, 2, 21, 0),
    ]);
  });
});

describe('reminderText', () => {
  const day = { date: '2026-11-05', count: 3, income: 0, expense: 250_000 };

  test('sums up a day with spending', () => {
    const { title, body } = reminderText(day, false);
    expect(title).toBe('Tổng kết hôm nay');
    expect(body).toContain('250.000');
    expect(body).toContain('3 khoản');
  });

  test('mentions income only when there is some', () => {
    const { body } = reminderText({ ...day, income: 5_000_000 }, false);
    expect(body).toContain('5.000.000');
    expect(body).toContain('250.000');
  });

  test('a day without entries only reminds', () => {
    expect(reminderText(undefined, false).body).toBe('Hôm nay bạn chưa ghi khoản nào. Chạm để thêm.');
    expect(reminderText({ ...day, count: 0, expense: 0 }, false).title).toBe('Nhắc ghi chi tiêu');
  });

  test('keeps amounts off the lock screen when a PIN is set', () => {
    const { body } = reminderText({ ...day, income: 5_000_000 }, true);
    expect(body).toContain('3 khoản');
    expect(body).not.toMatch(/\d{3}\.\d{3}/);
  });
});

test('formatReminderTime pads hours and minutes', () => {
  expect(formatReminderTime({ hour: 21, minute: 0 })).toBe('21:00');
  expect(formatReminderTime({ hour: 7, minute: 5 })).toBe('07:05');
});
