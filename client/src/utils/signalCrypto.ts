import { KeyHelper } from '@privacyresearch/libsignal-protocol-typescript';
import type {
  KeyPairType,
  PreKeyPairType,
  SignedPreKeyPairType,
} from '@privacyresearch/libsignal-protocol-typescript';

export type SignalPublicKeys = {
  identityKey: string;
  signedPreKey: {
    keyId: number;
    publicKey: string;
    signature: string;
    timestamp: number;
  };
  preKeys: Array<{
    keyId: number;
    publicKey: string;
  }>;
  registrationId: number;
  deviceId: number;
};

/**
 * Generate a new Signal Protocol identity
 */
export async function generateIdentity(): Promise<{
  identityKeyPair: KeyPairType;
  registrationId: number;
}> {
  const identityKeyPair = await KeyHelper.generateIdentityKeyPair();
  const registrationId = KeyHelper.generateRegistrationId();

  return { identityKeyPair, registrationId };
}

/**
 * Generate pre-keys for forward secrecy
 */
export async function generatePreKeys(
  startId: number,
  count: number
): Promise<PreKeyPairType[]> {
  const preKeys: PreKeyPairType[] = [];

  for (let i = 0; i < count; i++) {
    const keyId = startId + i;
    const preKey = await KeyHelper.generatePreKey(keyId);
    preKeys.push(preKey);
  }

  return preKeys;
}

/**
 * Generate a signed pre-key
 */
export async function generateSignedPreKey(
  identityKeyPair: KeyPairType,
  keyId: number
): Promise<SignedPreKeyPairType> {
  return await KeyHelper.generateSignedPreKey(identityKeyPair, keyId);
}

/**
 * Create public key bundle for server registration
 */
export function createPublicKeyBundle(
  identityKeyPair: KeyPairType,
  signedPreKey: SignedPreKeyPairType,
  preKeys: PreKeyPairType[],
  registrationId: number,
  deviceId: number
): SignalPublicKeys {
  return {
    identityKey: arrayBufferToBase64(identityKeyPair.pubKey),
    signedPreKey: {
      keyId: signedPreKey.keyId,
      publicKey: arrayBufferToBase64(signedPreKey.keyPair.pubKey),
      signature: arrayBufferToBase64(signedPreKey.signature),
      timestamp: Date.now(),
    },
    preKeys: preKeys.map((preKey) => ({
      keyId: preKey.keyId,
      publicKey: arrayBufferToBase64(preKey.keyPair.pubKey),
    })),
    registrationId,
    deviceId,
  };
}

/**
 * Convert ArrayBuffer to base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
