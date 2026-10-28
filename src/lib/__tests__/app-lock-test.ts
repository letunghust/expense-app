import { AUTO_LOCK_AFTER_MS, isValidPin, lockoutMs, shouldLockOnResume, SYSTEM_UI_AUTO_LOCK_AFTER_MS } from '../app-lock';

describe('app lock rules', () => {
  test('isValidPin accepts only 4 or 6 digits', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin('')).toBe(false);
  });

  test('lockoutMs grows after the free attempts and is capped', () => {
    expect(lockoutMs(0)).toBe(0);
    expect(lockoutMs(4)).toBe(0);
    expect(lockoutMs(5)).toBe(30_000);
    expect(lockoutMs(6)).toBe(60_000);
    expect(lockoutMs(7)).toBe(120_000);
    expect(lockoutMs(50)).toBe(15 * 60_000);
  });

  test('shouldLockOnResume', () => {
    expect(shouldLockOnResume(null, 1_000_000)).toBe(false);
    expect(shouldLockOnResume(1_000_000, 1_000_000 + AUTO_LOCK_AFTER_MS - 1)).toBe(false);
    expect(shouldLockOnResume(1_000_000, 1_000_000 + AUTO_LOCK_AFTER_MS)).toBe(true);
    // Longer grace while the photo picker or share sheet is open.
    expect(shouldLockOnResume(1_000_000, 1_000_000 + AUTO_LOCK_AFTER_MS, SYSTEM_UI_AUTO_LOCK_AFTER_MS)).toBe(false);
    expect(shouldLockOnResume(1_000_000, 1_000_000 + SYSTEM_UI_AUTO_LOCK_AFTER_MS, SYSTEM_UI_AUTO_LOCK_AFTER_MS)).toBe(true);
  });
});
