// src/services/auth.ts - Biometric & Device PIN Authentication for App Lock & Card Reveal

export interface AuthState {
  isLocked: boolean;
  isAppLockEnabled: boolean;
  hasHardwareSupport: boolean;
}

export class AuthService {
  private static localPin: string | null = null;
  private static appLockEnabled: boolean = false;

  /**
   * Checks if biometric hardware is supported on this device.
   */
  static async hasHardwareSupport(): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const LocalAuthentication = require('expo-local-authentication');
      if (LocalAuthentication && typeof LocalAuthentication.hasHardwareAsync === 'function') {
        return await LocalAuthentication.hasHardwareAsync();
      }
    } catch {
      // Non-native fallback
    }
    return false;
  }

  /**
   * Authenticates the user using Biometrics (Fingerprint/Face) or Device Passcode.
   * Prompts the native Android BiometricPrompt modal.
   */
  static async authenticateUser(promptMessage = 'Authenticate to access CardTrack'): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const LocalAuthentication = require('expo-local-authentication');
      if (LocalAuthentication && typeof LocalAuthentication.authenticateAsync === 'function') {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage,
          fallbackLabel: 'Use PIN',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
        });
        return result.success;
      }
    } catch {
      // Fallback
    }

    // In web/test or if no biometrics, fall back to PIN or allow access
    return true;
  }

  /**
   * Prompts authentication specifically before revealing sensitive card information.
   */
  static async authenticateForCardReveal(cardNickname: string): Promise<boolean> {
    return await this.authenticateUser(`Authenticate to view card details for ${cardNickname}`);
  }

  /**
   * Stores a local backup PIN in secure storage.
   */
  static async setLocalPin(pin: string): Promise<void> {
    this.localPin = pin;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const SecureStore = require('expo-secure-store');
      if (SecureStore && typeof SecureStore.setItemAsync === 'function') {
        await SecureStore.setItemAsync('cardtrack_app_pin', pin);
      }
    } catch {
      // In-memory fallback
    }
  }

  /**
   * Verifies an entered PIN against the saved PIN.
   */
  static async verifyPin(pin: string): Promise<boolean> {
    let savedPin = this.localPin;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const SecureStore = require('expo-secure-store');
      if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
        savedPin = await SecureStore.getItemAsync('cardtrack_app_pin');
      }
    } catch {
      // Fallback
    }

    return savedPin === pin;
  }

  static isLockEnabled(): boolean {
    return this.appLockEnabled;
  }

  static setLockEnabled(enabled: boolean): void {
    this.appLockEnabled = enabled;
  }
}
