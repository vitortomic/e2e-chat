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
  const { identityKeyPair, registrationId } = await generateIdentity();

  const preKeys = await generatePreKeys(PRE_KEY_START_ID, PRE_KEY_COUNT);
  const signedPreKey = await generateSignedPreKey(identityKeyPair, SIGNED_PRE_KEY_ID);

  await signalStore.initialize(identityKeyPair, registrationId);

  for (const preKey of preKeys) {
    await signalStore.storePreKey(preKey.keyId, preKey.keyPair);
  }
  await signalStore.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

  const publicKeys = createPublicKeyBundle(
    identityKeyPair,
    signedPreKey,
    preKeys,
    registrationId,
    DEVICE_ID
  );

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
  const response = await api.login({ username, password });

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
  api.clearToken();
}

/**
 * Delete account and all Signal Protocol data
 */
export async function deleteAccountWithSignal(): Promise<void> {
  await signalStore.clear();
  api.clearToken();
}
