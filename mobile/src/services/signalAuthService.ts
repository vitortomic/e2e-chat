import { api } from './api';
import { signalStore } from './signalProtocolStore';
import {
  generateIdentity,
  generatePreKeys,
  generateSignedPreKey,
  createPublicKeyBundle,
} from '../utils/signalCrypto';
import { DEVICE_ID, PRE_KEY_COUNT, PRE_KEY_START_ID, SIGNED_PRE_KEY_ID } from '../constants';

/**
 * Register new user with Signal Protocol
 */
export async function registerUserWithSignal(
  username: string,
  password: string
): Promise<{ userId: string; username: string }> {
  // Generate Signal Protocol identity
  const { identityKeyPair, registrationId } = await generateIdentity();

  const preKeys = await generatePreKeys(PRE_KEY_START_ID, PRE_KEY_COUNT);
  const signedPreKey = await generateSignedPreKey(identityKeyPair, SIGNED_PRE_KEY_ID);

  // Initialize the Signal Protocol store
  await signalStore.initialize(identityKeyPair, registrationId);

  // Save pre-keys and signed pre-key to store
  for (const preKey of preKeys) {
    await signalStore.storePreKey(preKey.keyId, preKey.keyPair);
  }
  await signalStore.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

  // Create public key bundle for server
  const publicKeys = await createPublicKeyBundle(
    identityKeyPair,
    signedPreKey,
    preKeys,
    registrationId,
    DEVICE_ID
  );

  // Register with server (send public keys only)
  const response = await api.register({
    username,
    password,
    publicKeys,
  });

  return {
    userId: response.userId,
    username: response.username,
  };
}

/**
 * Login existing user with Signal Protocol
 */
export async function loginUserWithSignal(
  username: string,
  password: string
): Promise<{ userId: string; username: string; hasKeys: boolean }> {
  // Login to get token
  const response = await api.login({ username, password });

  // Try to load existing Signal Protocol identity from storage
  const hasKeys = await signalStore.loadIdentity();

  if (!hasKeys) {
    console.warn('No Signal Protocol keys found in storage');
  }

  return {
    userId: response.userId,
    username: response.username,
    hasKeys,
  };
}

/**
 * Logout user
 */
export async function logoutUserWithSignal(): Promise<void> {
  await api.clearToken();
  // Keep Signal Protocol sessions for next login
}

/**
 * Delete account and all Signal Protocol data
 */
export async function deleteAccountWithSignal(): Promise<void> {
  await signalStore.clear();
  await api.clearToken();
}
