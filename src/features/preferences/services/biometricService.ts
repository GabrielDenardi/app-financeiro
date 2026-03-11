import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BIOMETRIC_FLAG_KEY = 'finance_biometric_lock';

export async function canUseBiometricLock() {
  if (Platform.OS === 'web') {
    return false;
  }

  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);

  return hasHardware && isEnrolled;
}

export async function setBiometricLockEnabled(enabled: boolean) {
  if (Platform.OS === 'web') {
    return;
  }

  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_FLAG_KEY, 'enabled');
    return;
  }

  await SecureStore.deleteItemAsync(BIOMETRIC_FLAG_KEY);
}

export async function isBiometricLockEnabledLocally() {
  if (Platform.OS === 'web') {
    return false;
  }

  const value = await SecureStore.getItemAsync(BIOMETRIC_FLAG_KEY);
  return value === 'enabled';
}

export async function authenticateWithBiometrics(promptMessage = 'Desbloqueie o app') {
  if (Platform.OS === 'web') {
    return { success: true as const };
  }

  return LocalAuthentication.authenticateAsync({
    promptMessage,
    fallbackLabel: 'Usar senha do aparelho',
    cancelLabel: 'Cancelar',
    disableDeviceFallback: false,
  });
}
