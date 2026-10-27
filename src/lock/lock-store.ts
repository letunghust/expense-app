import * as Crypto from 'expo-crypto';

import { type PinLength, lockoutMs } from '@/lib/app-lock';
import { secureStorage } from '@/lib/secure-storage';

const KEYS = {
  pinHash: 'appLock.pinHash',
  salt: 'appLock.salt',
  pinLength: 'appLock.pinLength',
  biometrics: 'appLock.biometrics',
  failures: 'appLock.failures', // "<count>|<lockedUntilMs>"
} as const;

export type LockSettings = {
  pinEnabled: boolean;
  pinLength: PinLength;
  biometricsEnabled: boolean;
};

export type FailureState = { count: number; lockedUntil: number };

/** The PIN itself is never stored, only a salted SHA-256 hash of it. */
function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function loadLockSettings(): Promise<LockSettings> {
  const [hash, length, biometrics] = await Promise.all([
    secureStorage.getItem(KEYS.pinHash),
    secureStorage.getItem(KEYS.pinLength),
    secureStorage.getItem(KEYS.biometrics),
  ]);
  const pinEnabled = hash != null;
  return {
    pinEnabled,
    pinLength: length === '4' ? 4 : 6,
    biometricsEnabled: pinEnabled && biometrics === '1',
  };
}

export async function savePin(pin: string): Promise<void> {
  const salt = Crypto.randomUUID();
  const hash = await hashPin(pin, salt);
  await secureStorage.setItem(KEYS.salt, salt);
  await secureStorage.setItem(KEYS.pinLength, String(pin.length));
  await secureStorage.setItem(KEYS.pinHash, hash);
  await secureStorage.deleteItem(KEYS.failures);
}

export async function checkPin(pin: string): Promise<boolean> {
  const [hash, salt] = await Promise.all([secureStorage.getItem(KEYS.pinHash), secureStorage.getItem(KEYS.salt)]);
  if (hash == null || salt == null) return false;
  return (await hashPin(pin, salt)) === hash;
}

/** Turns the app lock off entirely. */
export async function clearPin(): Promise<void> {
  await Promise.all(Object.values(KEYS).map((key) => secureStorage.deleteItem(key)));
}

export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  if (enabled) await secureStorage.setItem(KEYS.biometrics, '1');
  else await secureStorage.deleteItem(KEYS.biometrics);
}

// Failed attempts are persisted so that restarting the app doesn't reset the lockout.

export async function loadFailures(): Promise<FailureState> {
  const raw = await secureStorage.getItem(KEYS.failures);
  const [count, lockedUntil] = (raw ?? '0|0').split('|').map(Number);
  return { count: count || 0, lockedUntil: lockedUntil || 0 };
}

export async function recordFailure(now = Date.now()): Promise<FailureState> {
  const { count } = await loadFailures();
  const next = { count: count + 1, lockedUntil: now + lockoutMs(count + 1) };
  await secureStorage.setItem(KEYS.failures, `${next.count}|${next.lockedUntil}`);
  return next;
}

export async function resetFailures(): Promise<void> {
  await secureStorage.deleteItem(KEYS.failures);
}
