import type { BiometricSupport } from './biometrics';

/** Browsers have no fingerprint API that fits here; the web preview only offers the PIN. */
export async function getBiometricSupport(): Promise<BiometricSupport> {
  return { available: false, notEnrolled: false, label: 'vân tay' };
}

export async function authenticateWithBiometrics(_promptMessage: string): Promise<boolean> {
  return false;
}
