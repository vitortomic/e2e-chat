import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  StorageType,
  KeyPairType,
  Direction,
  SessionRecordType,
} from '@privacyresearch/libsignal-protocol-typescript';
import { arrayBufferToBase64, base64ToArrayBuffer } from '../utils/signalCrypto';
import { secureStorage } from '../storage/secureStorage';

/**
 * Signal Protocol Store implementation for React Native
 * Uses:
 * - Keychain (secureStorage) for sensitive keys (identity, pre-keys, signed pre-keys)
 * - AsyncStorage for sessions and identity keys from other users
 */
class SignalProtocolStore implements StorageType {
  private identityKeyPair: KeyPairType | null = null;
  private registrationId: number | null = null;

  /**
   * Initialize with identity key pair and registration ID
   */
  async initialize(identityKeyPair: KeyPairType, registrationId: number): Promise<void> {
    this.identityKeyPair = identityKeyPair;
    this.registrationId = registrationId;

    // Store identity in Keychain (secure)
    await secureStorage.setItem(
      'signal_identityKeyPair',
      JSON.stringify({
        pubKey: arrayBufferToBase64(identityKeyPair.pubKey),
        privKey: arrayBufferToBase64(identityKeyPair.privKey),
      })
    );

    await secureStorage.setItem('signal_registrationId', registrationId.toString());
  }

  /**
   * Load identity from storage
   */
  async loadIdentity(): Promise<boolean> {
    const keyPairStr = await secureStorage.getItem('signal_identityKeyPair');
    const regIdStr = await secureStorage.getItem('signal_registrationId');

    if (keyPairStr && regIdStr) {
      const keyPair = JSON.parse(keyPairStr);
      this.identityKeyPair = {
        pubKey: base64ToArrayBuffer(keyPair.pubKey),
        privKey: base64ToArrayBuffer(keyPair.privKey),
      };
      this.registrationId = parseInt(regIdStr, 10);
      return true;
    }

    return false;
  }

  // StorageType interface implementation

  async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
    return this.identityKeyPair || undefined;
  }

  async getLocalRegistrationId(): Promise<number | undefined> {
    return this.registrationId || undefined;
  }

  async isTrustedIdentity(
    identifier: string,
    identityKey: ArrayBuffer,
    _direction: Direction
  ): Promise<boolean> {
    // Trust on first use (TOFU)
    const storedKey = await AsyncStorage.getItem(`signal_identityKey_${identifier}`);

    if (!storedKey) {
      return true; // First time seeing this identity
    }

    // Check if it matches
    return storedKey === arrayBufferToBase64(identityKey);
  }

  async saveIdentity(
    encodedAddress: string,
    publicKey: ArrayBuffer,
    _nonblockingApproval?: boolean
  ): Promise<boolean> {
    const storedKey = await AsyncStorage.getItem(`signal_identityKey_${encodedAddress}`);

    if (storedKey && storedKey !== arrayBufferToBase64(publicKey)) {
      // Identity key has changed
      return false;
    }

    await AsyncStorage.setItem(
      `signal_identityKey_${encodedAddress}`,
      arrayBufferToBase64(publicKey)
    );
    return true;
  }

  async loadPreKey(keyId: string | number): Promise<KeyPairType | undefined> {
    const preKeyStr = await secureStorage.getItem(`signal_preKey_${keyId}`);

    if (!preKeyStr) return undefined;

    const preKey = JSON.parse(preKeyStr);
    return {
      pubKey: base64ToArrayBuffer(preKey.pubKey),
      privKey: base64ToArrayBuffer(preKey.privKey),
    };
  }

  async storePreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    await secureStorage.setItem(
      `signal_preKey_${keyId}`,
      JSON.stringify({
        pubKey: arrayBufferToBase64(keyPair.pubKey),
        privKey: arrayBufferToBase64(keyPair.privKey),
      })
    );
  }

  async removePreKey(keyId: number | string): Promise<void> {
    await secureStorage.removeItem(`signal_preKey_${keyId}`);
  }

  async storeSession(encodedAddress: string, record: SessionRecordType): Promise<void> {
    // Sessions in AsyncStorage (can be reconstructed if needed)
    await AsyncStorage.setItem(`signal_session_${encodedAddress}`, JSON.stringify(record));
  }

  async loadSession(encodedAddress: string): Promise<SessionRecordType | undefined> {
    const sessionStr = await AsyncStorage.getItem(`signal_session_${encodedAddress}`);

    if (!sessionStr) return undefined;

    return JSON.parse(sessionStr);
  }

  async loadSignedPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
    const signedPreKeyStr = await secureStorage.getItem(`signal_signedPreKey_${keyId}`);

    if (!signedPreKeyStr) return undefined;

    const signedPreKey = JSON.parse(signedPreKeyStr);
    return {
      pubKey: base64ToArrayBuffer(signedPreKey.pubKey),
      privKey: base64ToArrayBuffer(signedPreKey.privKey),
    };
  }

  async storeSignedPreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    await secureStorage.setItem(
      `signal_signedPreKey_${keyId}`,
      JSON.stringify({
        pubKey: arrayBufferToBase64(keyPair.pubKey),
        privKey: arrayBufferToBase64(keyPair.privKey),
      })
    );
  }

  async removeSignedPreKey(keyId: number | string): Promise<void> {
    await secureStorage.removeItem(`signal_signedPreKey_${keyId}`);
  }

  /**
   * Clear all data from the store
   */
  async clear(): Promise<void> {
    // Clear from Keychain
    await secureStorage.removeItem('signal_identityKeyPair');
    await secureStorage.removeItem('signal_registrationId');

    // Clear all Signal-related items from AsyncStorage
    const keys = await AsyncStorage.getAllKeys();
    const signalKeys = keys.filter(key => key.startsWith('signal_'));
    if (signalKeys.length > 0) {
      await AsyncStorage.multiRemove(signalKeys);
    }

    this.identityKeyPair = null;
    this.registrationId = null;
  }
}

export const signalStore = new SignalProtocolStore();
