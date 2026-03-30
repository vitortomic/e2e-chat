import { describe, it, expect } from 'vitest';
import {
  SocketEvents,
  DEVICE_ID,
  PRE_KEY_COUNT,
  PRE_KEY_START_ID,
  SIGNED_PRE_KEY_ID,
  SignalMessageType,
  DB_NAMES,
  SignalStoreNames,
  IMAGE_MAX_SIZE_BYTES,
  IMAGE_MAX_DIMENSION,
  IMAGE_COMPRESSION_QUALITY,
  TYPING_TIMEOUT_MS,
  STORAGE_KEYS,
} from '../constants';

describe('constants', () => {
  describe('SocketEvents', () => {
    it('should have all outgoing events', () => {
      expect(SocketEvents.MESSAGE_SEND).toBe('message:send');
      expect(SocketEvents.TYPING_START).toBe('typing:start');
      expect(SocketEvents.TYPING_STOP).toBe('typing:stop');
      expect(SocketEvents.MESSAGE_READ).toBe('message:read');
      expect(SocketEvents.USERS_GET_ONLINE).toBe('users:get-online');
      expect(SocketEvents.CHAT_ENTER).toBe('chat:enter');
      expect(SocketEvents.CHAT_LEAVE).toBe('chat:leave');
      expect(SocketEvents.CHAT_REQUEST).toBe('chat:request');
    });

    it('should have all incoming events', () => {
      expect(SocketEvents.MESSAGE_RECEIVE).toBe('message:receive');
      expect(SocketEvents.MESSAGES_PENDING).toBe('messages:pending');
      expect(SocketEvents.USER_ONLINE).toBe('user:online');
      expect(SocketEvents.USER_OFFLINE).toBe('user:offline');
      expect(SocketEvents.MESSAGE_DELIVERED).toBe('message:delivered');
      expect(SocketEvents.CHAT_SESSION_STATUS).toBe('chat:session-status');
      expect(SocketEvents.CHAT_REQUEST_RECEIVED).toBe('chat:request-received');
      expect(SocketEvents.CHAT_USER_ENTERED).toBe('chat:user-entered');
      expect(SocketEvents.CHAT_USER_LEFT).toBe('chat:user-left');
      expect(SocketEvents.USERS_ONLINE_LIST).toBe('users:online-list');
    });
  });

  describe('Signal Protocol constants', () => {
    it('should have correct device ID', () => {
      expect(DEVICE_ID).toBe(1);
    });

    it('should have correct pre-key settings', () => {
      expect(PRE_KEY_COUNT).toBe(20);
      expect(PRE_KEY_START_ID).toBe(1);
      expect(SIGNED_PRE_KEY_ID).toBe(1);
    });

    it('should have correct message types matching Signal Protocol spec', () => {
      expect(SignalMessageType.WHISPER).toBe(1);
      expect(SignalMessageType.PRE_KEY).toBe(3);
    });
  });

  describe('IndexedDB constants', () => {
    it('should have database names', () => {
      expect(DB_NAMES.SIGNAL_STORE).toBe('signal-protocol-store');
    });

    it('should have all store names', () => {
      expect(SignalStoreNames.IDENTITY).toBe('identity');
      expect(SignalStoreNames.PRE_KEYS).toBe('preKeys');
      expect(SignalStoreNames.SIGNED_PRE_KEYS).toBe('signedPreKeys');
      expect(SignalStoreNames.SESSIONS).toBe('sessions');
      expect(SignalStoreNames.IDENTITY_KEYS).toBe('identityKeys');
    });
  });

  describe('Image constraints', () => {
    it('should have a max size of 5MB', () => {
      expect(IMAGE_MAX_SIZE_BYTES).toBe(5 * 1024 * 1024);
    });

    it('should have reasonable dimension limit', () => {
      expect(IMAGE_MAX_DIMENSION).toBe(800);
    });

    it('should have compression quality between 0 and 1', () => {
      expect(IMAGE_COMPRESSION_QUALITY).toBeGreaterThan(0);
      expect(IMAGE_COMPRESSION_QUALITY).toBeLessThanOrEqual(1);
    });
  });

  describe('Other constants', () => {
    it('should have a positive typing timeout', () => {
      expect(TYPING_TIMEOUT_MS).toBeGreaterThan(0);
    });

    it('should have auth token storage key', () => {
      expect(STORAGE_KEYS.AUTH_TOKEN).toBe('auth_token');
    });
  });
});
