import type { BiometricSupport } from './biometrics';

import { strings } from '@/i18n';

/** Browsers have no fingerprint API that fits here; the web preview only offers the PIN. */
export async function getBiometricSupport(): Promise<BiometricSupport> {
  return { available: false, notEnrolled: false, label: strings().lock.fingerprint };
}

export async function authenticateWithBiometrics(_promptMessage: string): Promise<boolean> {
  return false;
}
