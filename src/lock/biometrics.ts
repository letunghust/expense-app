import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricSupport = {
  /** Hardware exists and the user has enrolled at least one fingerprint/face. */
  available: boolean;
  /** Hardware exists but nothing is enrolled yet. */
  notEnrolled: boolean;
  /** What to call it in the UI, e.g. "vân tay". */
  label: string;
};

export async function getBiometricSupport(): Promise<BiometricSupport> {
  const [hasHardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const { FINGERPRINT, FACIAL_RECOGNITION } = LocalAuthentication.AuthenticationType;
  const label = types.includes(FINGERPRINT)
    ? 'vân tay'
    : types.includes(FACIAL_RECOGNITION)
      ? 'khuôn mặt'
      : 'sinh trắc học';
  return { available: hasHardware && enrolled, notEnrolled: hasHardware && !enrolled, label };
}

/**
 * Shows the system biometric prompt. The device passcode fallback is disabled
 * so that the app's own PIN stays the only alternative way in.
 */
export async function authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Dùng mã PIN',
    disableDeviceFallback: true,
  });
  return result.success;
}
