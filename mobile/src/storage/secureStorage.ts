import * as Keychain from 'react-native-keychain';

/**
 * Secure storage wrapper using React Native Keychain
 * Stores sensitive data (encryption keys) in iOS Keychain
 */
export const secureStorage = {
  /**
   * Store a key-value pair securely
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      await Keychain.setGenericPassword(key, value, { service: key });
    } catch (error) {
      console.error('Secure storage setItem error:', error);
      throw error;
    }
  },

  /**
   * Retrieve a value by key
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const result = await Keychain.getGenericPassword({ service: key });
      return result ? result.password : null;
    } catch (error) {
      console.error('Secure storage getItem error:', error);
      return null;
    }
  },

  /**
   * Remove a key-value pair
   */
  async removeItem(key: string): Promise<void> {
    try {
      await Keychain.resetGenericPassword({ service: key });
    } catch (error) {
      console.error('Secure storage removeItem error:', error);
      throw error;
    }
  },

  /**
   * Clear all stored data
   */
  async clear(): Promise<void> {
    // Note: This is a placeholder. In a real app, you'd need to track
    // all keys and remove them individually
    console.warn('Secure storage clear() - implement key tracking if needed');
  },
};
