import * as LocalAuthentication from 'expo-local-authentication';

import { strings } from '@/i18n';

export type BiometricSupport = {
  /** Hardware exists and the user has enrolled at least one fingerprint/face. */
  available: boolean;
  /** Hardware exists but nothing is enrolled yet. */
  notEnrolled: boolean;
  /** What to call it in the UI, e.g. "vân tay" / "fingerprint". */
  label: string;
};

export async function getBiometricSupport(): Promise<BiometricSupport> {
  const [hasHardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const { FINGERPRINT, FACIAL_RECOGNITION } = LocalAuthentication.AuthenticationType;
  const t = strings().lock;
  const label = types.includes(FINGERPRINT) ? t.fingerprint : types.includes(FACIAL_RECOGNITION) ? t.face : t.biometrics;
  return { available: hasHardware && enrolled, notEnrolled: hasHardware && !enrolled, label };
}

/**
 * Shows the system biometric prompt. The device passcode fallback is disabled
 * so that the app's own PIN stays the only alternative way in.
 */
export async function authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: strings().lock.usePin,
    disableDeviceFallback: true,
  });
  return result.success;
}
