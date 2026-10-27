/** Rules for the app lock that don't depend on storage or native modules. */

export const PIN_LENGTHS = [4, 6] as const;
export type PinLength = (typeof PIN_LENGTHS)[number];

/** How long the app may stay in the background before it locks again. */
export const AUTO_LOCK_AFTER_MS = 30_000;

/** Wrong PIN attempts allowed before the keypad is temporarily disabled. */
export const FREE_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 15 * 60_000;

export function isValidPin(pin: string): boolean {
  return /^\d+$/.test(pin) && (PIN_LENGTHS as readonly number[]).includes(pin.length);
}

/**
 * Lockout after `failures` consecutive wrong PINs: none for the first few,
 * then 30s, doubling with each further failure, capped at 15 minutes.
 */
export function lockoutMs(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0;
  return Math.min(BASE_LOCKOUT_MS * 2 ** (failures - FREE_ATTEMPTS), MAX_LOCKOUT_MS);
}

export function shouldLockOnResume(backgroundedAt: number | null, now: number): boolean {
  return backgroundedAt != null && now - backgroundedAt >= AUTO_LOCK_AFTER_MS;
}
