import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type {
  StorageType,
  KeyPairType,
  Direction,
  SessionRecordType,
} from '@privacyresearch/libsignal-protocol-typescript';
import { arrayBufferToBase64, base64ToArrayBuffer } from '../utils/signalCrypto';
import { DB_NAMES, SignalStoreNames } from '../constants';

interface SerializedKeyPair {
  pubKey: string;
  privKey: string;
}

interface SignalDB {
  [SignalStoreNames.IDENTITY]: {
    key: string;
    value: SerializedKeyPair | number;
  };
  [SignalStoreNames.PRE_KEYS]: {
    key: number | string;
    value: SerializedKeyPair;
  };
  [SignalStoreNames.SIGNED_PRE_KEYS]: {
    key: number | string;
    value: SerializedKeyPair;
  };
  [SignalStoreNames.SESSIONS]: {
    key: string;
    value: SessionRecordType;
  };
  [SignalStoreNames.IDENTITY_KEYS]: {
    key: string;
    value: string;
  };
}

class SignalProtocolStore implements StorageType {
  private db: IDBPDatabase<SignalDB> | null = null;
  private identityKeyPair: KeyPairType | null = null;
  private registrationId: number | null = null;

  private async initDB(): Promise<IDBPDatabase<SignalDB>> {
    if (this.db) return this.db;

    this.db = await openDB<SignalDB>(DB_NAMES.SIGNAL_STORE, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SignalStoreNames.IDENTITY)) {
          db.createObjectStore(SignalStoreNames.IDENTITY);
        }
        if (!db.objectStoreNames.contains(SignalStoreNames.PRE_KEYS)) {
          db.createObjectStore(SignalStoreNames.PRE_KEYS);
        }
        if (!db.objectStoreNames.contains(SignalStoreNames.SIGNED_PRE_KEYS)) {
          db.createObjectStore(SignalStoreNames.SIGNED_PRE_KEYS);
        }
        if (!db.objectStoreNames.contains(SignalStoreNames.SESSIONS)) {
          db.createObjectStore(SignalStoreNames.SESSIONS);
        }
        if (!db.objectStoreNames.contains(SignalStoreNames.IDENTITY_KEYS)) {
          db.createObjectStore(SignalStoreNames.IDENTITY_KEYS);
        }
      },
    });

    return this.db;
  }

  async initialize(identityKeyPair: KeyPairType, registrationId: number): Promise<void> {
    this.identityKeyPair = identityKeyPair;
    this.registrationId = registrationId;

    const db = await this.initDB();

    await db.put(SignalStoreNames.IDENTITY, {
      pubKey: arrayBufferToBase64(identityKeyPair.pubKey),
      privKey: arrayBufferToBase64(identityKeyPair.privKey),
    }, 'identityKeyPair');

    await db.put(SignalStoreNames.IDENTITY, registrationId, 'registrationId');
  }

  async loadIdentity(): Promise<boolean> {
    const db = await this.initDB();

    const keyPair = await db.get(SignalStoreNames.IDENTITY, 'identityKeyPair');
    const regId = await db.get(SignalStoreNames.IDENTITY, 'registrationId');

    if (keyPair && typeof keyPair === 'object' && 'pubKey' in keyPair && typeof regId === 'number') {
      this.identityKeyPair = {
        pubKey: base64ToArrayBuffer(keyPair.pubKey),
        privKey: base64ToArrayBuffer(keyPair.privKey),
      };
      this.registrationId = regId;
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
    const db = await this.initDB();
    const storedKey = await db.get(SignalStoreNames.IDENTITY_KEYS, identifier);

    if (!storedKey) {
      return true; // Trust on first use (TOFU)
    }

    return storedKey === arrayBufferToBase64(identityKey);
  }

  async saveIdentity(
    encodedAddress: string,
    publicKey: ArrayBuffer,
    _nonblockingApproval?: boolean
  ): Promise<boolean> {
    const db = await this.initDB();
    const storedKey = await db.get(SignalStoreNames.IDENTITY_KEYS, encodedAddress);

    if (storedKey && storedKey !== arrayBufferToBase64(publicKey)) {
      return false; // Identity key has changed
    }

    await db.put(SignalStoreNames.IDENTITY_KEYS, arrayBufferToBase64(publicKey), encodedAddress);
    return true;
  }

  async loadPreKey(keyId: string | number): Promise<KeyPairType | undefined> {
    const db = await this.initDB();
    const preKey = await db.get(SignalStoreNames.PRE_KEYS, keyId);

    if (!preKey) return undefined;

    return {
      pubKey: base64ToArrayBuffer(preKey.pubKey),
      privKey: base64ToArrayBuffer(preKey.privKey),
    };
  }

  async storePreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    const db = await this.initDB();
    await db.put(SignalStoreNames.PRE_KEYS, {
      pubKey: arrayBufferToBase64(keyPair.pubKey),
      privKey: arrayBufferToBase64(keyPair.privKey),
    }, keyId);
  }

  async removePreKey(keyId: number | string): Promise<void> {
    const db = await this.initDB();
    await db.delete(SignalStoreNames.PRE_KEYS, keyId);
  }

  async storeSession(encodedAddress: string, record: SessionRecordType): Promise<void> {
    const db = await this.initDB();
    await db.put(SignalStoreNames.SESSIONS, record, encodedAddress);
  }

  async loadSession(encodedAddress: string): Promise<SessionRecordType | undefined> {
    const db = await this.initDB();
    return await db.get(SignalStoreNames.SESSIONS, encodedAddress);
  }

  async loadSignedPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
    const db = await this.initDB();
    const signedPreKey = await db.get(SignalStoreNames.SIGNED_PRE_KEYS, keyId);

    if (!signedPreKey) return undefined;

    return {
      pubKey: base64ToArrayBuffer(signedPreKey.pubKey),
      privKey: base64ToArrayBuffer(signedPreKey.privKey),
    };
  }

  async storeSignedPreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    const db = await this.initDB();
    await db.put(SignalStoreNames.SIGNED_PRE_KEYS, {
      pubKey: arrayBufferToBase64(keyPair.pubKey),
      privKey: arrayBufferToBase64(keyPair.privKey),
    }, keyId);
  }

  async removeSignedPreKey(keyId: number | string): Promise<void> {
    const db = await this.initDB();
    await db.delete(SignalStoreNames.SIGNED_PRE_KEYS, keyId);
  }

  async clear(): Promise<void> {
    const db = await this.initDB();
    await db.clear(SignalStoreNames.IDENTITY);
    await db.clear(SignalStoreNames.PRE_KEYS);
    await db.clear(SignalStoreNames.SIGNED_PRE_KEYS);
    await db.clear(SignalStoreNames.SESSIONS);
    await db.clear(SignalStoreNames.IDENTITY_KEYS);

    this.identityKeyPair = null;
    this.registrationId = null;
  }
}

export const signalStore = new SignalProtocolStore();
