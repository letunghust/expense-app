import * as SecureStore from 'expo-secure-store';

/** Small key-value store backed by the Android Keystore / iOS Keychain. */
export const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  deleteItem: (key: string) => SecureStore.deleteItemAsync(key),
};
