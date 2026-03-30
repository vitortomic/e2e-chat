import { SignalMessageType } from '../src/constants';

// Mock dependencies
jest.mock('../src/services/api', () => ({
  api: {
    getUserPublicKeys: jest.fn(),
  },
}));

jest.mock('../src/services/socketService', () => ({
  socketService: {
    sendMessage: jest.fn(),
    sendTypingStart: jest.fn(),
    sendTypingStop: jest.fn(),
    sendReadReceipt: jest.fn(),
  },
}));

jest.mock('../src/services/signalProtocolStore', () => ({
  signalStore: {
    loadSession: jest.fn(),
  },
}));

const mockEncrypt = jest.fn().mockResolvedValue({
  type: SignalMessageType.PRE_KEY,
  body: 'encrypted-body',
});

const mockDecryptPreKey = jest.fn().mockResolvedValue(
  new TextEncoder().encode('Hello, World!').buffer
);

const mockDecryptWhisper = jest.fn().mockResolvedValue(
  new TextEncoder().encode('Hello again!').buffer
);

jest.mock('@privacyresearch/libsignal-protocol-typescript', () => ({
  SignalProtocolAddress: jest.fn().mockImplementation(function (this: any, id: string, deviceId: number) {
    this.id = id;
    this.deviceId = deviceId;
    this.toString = () => `${id}.${deviceId}`;
  }),
  SessionBuilder: jest.fn().mockImplementation(() => ({
    processPreKey: jest.fn().mockResolvedValue(undefined),
  })),
  SessionCipher: jest.fn().mockImplementation(() => ({
    encrypt: mockEncrypt,
    decryptPreKeyWhisperMessage: mockDecryptPreKey,
    decryptWhisperMessage: mockDecryptWhisper,
  })),
}));

import { signalMessagingService } from '../src/services/signalMessagingService';
import { socketService } from '../src/services/socketService';
import { signalStore } from '../src/services/signalProtocolStore';
import { api } from '../src/services/api';

describe('SignalMessagingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    signalMessagingService.clear();
  });

  describe('initialize / clear', () => {
    it('should not be initialized by default', () => {
      expect(signalMessagingService.isInitialized()).toBe(false);
    });

    it('should be initialized after calling initialize', () => {
      signalMessagingService.initialize('user-1');
      expect(signalMessagingService.isInitialized()).toBe(true);
    });

    it('should not be initialized after calling clear', () => {
      signalMessagingService.initialize('user-1');
      signalMessagingService.clear();
      expect(signalMessagingService.isInitialized()).toBe(false);
    });
  });

  describe('sendMessage', () => {
    it('should throw if not initialized', async () => {
      await expect(
        signalMessagingService.sendMessage('recipient-1', 'hello')
      ).rejects.toThrow('Messaging service not initialized');
    });

    it('should encrypt and send a message with existing session', async () => {
      signalMessagingService.initialize('user-1');
      (signalStore.loadSession as jest.Mock).mockResolvedValue({});

      await signalMessagingService.sendMessage('recipient-1', 'hello');

      expect(socketService.sendMessage).toHaveBeenCalledWith('recipient-1', {
        ciphertext: expect.any(String),
        nonce: SignalMessageType.PRE_KEY.toString(),
        senderPublicKey: 'user-1',
      });
    });

    it('should establish session if none exists', async () => {
      signalMessagingService.initialize('user-1');
      (signalStore.loadSession as jest.Mock).mockResolvedValue(undefined);
      (api.getUserPublicKeys as jest.Mock).mockResolvedValue({
        publicKeys: {
          identityKey: 'aWRlbnRpdHk=',
          signedPreKey: {
            keyId: 1,
            publicKey: 'c2lnbmVk',
            signature: 'c2ln',
            timestamp: Date.now(),
          },
          preKeys: [{
            keyId: 1,
            publicKey: 'cHJlS2V5',
          }],
        },
        registrationId: 12345,
        deviceId: 1,
      });

      await signalMessagingService.sendMessage('recipient-1', 'hello');

      expect(api.getUserPublicKeys).toHaveBeenCalledWith('recipient-1');
      expect(socketService.sendMessage).toHaveBeenCalled();
    });
  });

  describe('sendImage', () => {
    it('should reject images that are too large', async () => {
      signalMessagingService.initialize('user-1');

      const largeBase64 = 'A'.repeat(8 * 1024 * 1024);

      await expect(
        signalMessagingService.sendImage('recipient-1', largeBase64)
      ).rejects.toThrow('Image too large');
    });

    it('should send image as JSON-encoded message', async () => {
      signalMessagingService.initialize('user-1');
      (signalStore.loadSession as jest.Mock).mockResolvedValue({});

      const smallBase64 = 'data:image/jpeg;base64,/9j/small';

      await signalMessagingService.sendImage('recipient-1', smallBase64);

      expect(socketService.sendMessage).toHaveBeenCalled();
    });
  });

  describe('decryptIncomingMessage', () => {
    it('should decrypt a PreKey message', async () => {
      const message = {
        id: 'msg-1',
        senderId: 'sender-1',
        encryptedContent: {
          ciphertext: 'Y2lwaGVydGV4dA==',
          nonce: SignalMessageType.PRE_KEY.toString(),
          senderPublicKey: 'sender-1',
        },
        timestamp: new Date(),
      };

      const result = await signalMessagingService.decryptIncomingMessage(message);

      expect(result.id).toBe('msg-1');
      expect(result.senderId).toBe('sender-1');
      expect(result.content).toBe('Hello, World!');
      expect(result.messageType).toBe('text');
      expect(result.decryptionFailed).toBeUndefined();
    });

    it('should decrypt a Whisper message', async () => {
      const message = {
        id: 'msg-2',
        senderId: 'sender-1',
        encryptedContent: {
          ciphertext: 'Y2lwaGVydGV4dA==',
          nonce: SignalMessageType.WHISPER.toString(),
          senderPublicKey: 'sender-1',
        },
        timestamp: new Date(),
      };

      const result = await signalMessagingService.decryptIncomingMessage(message);

      expect(result.content).toBe('Hello again!');
      expect(mockDecryptWhisper).toHaveBeenCalled();
    });

    it('should decrypt an image message', async () => {
      const imageJson = JSON.stringify({ type: 'image', data: 'data:image/jpeg;base64,abc' });
      mockDecryptPreKey.mockResolvedValueOnce(
        new TextEncoder().encode(imageJson).buffer
      );

      const message = {
        id: 'msg-img',
        senderId: 'sender-1',
        encryptedContent: {
          ciphertext: 'Y2lwaGVydGV4dA==',
          nonce: SignalMessageType.PRE_KEY.toString(),
          senderPublicKey: 'sender-1',
        },
        timestamp: new Date(),
      };

      const result = await signalMessagingService.decryptIncomingMessage(message);

      expect(result.messageType).toBe('image');
      expect(result.imageData).toBe('data:image/jpeg;base64,abc');
      expect(result.content).toBe('[Image]');
    });

    it('should return decryption failed message on error', async () => {
      mockDecryptPreKey.mockRejectedValueOnce(new Error('bad mac'));

      const message = {
        id: 'msg-fail',
        senderId: 'sender-1',
        encryptedContent: {
          ciphertext: 'Y2lwaGVydGV4dA==',
          nonce: SignalMessageType.PRE_KEY.toString(),
          senderPublicKey: 'sender-1',
        },
        timestamp: new Date(),
      };

      const result = await signalMessagingService.decryptIncomingMessage(message);

      expect(result.decryptionFailed).toBe(true);
      expect(result.content).toBe('[Failed to decrypt message]');
    });
  });

  describe('typing indicators', () => {
    it('should forward startTyping to socket', () => {
      signalMessagingService.startTyping('recipient-1');
      expect(socketService.sendTypingStart).toHaveBeenCalledWith('recipient-1');
    });

    it('should forward stopTyping to socket', () => {
      signalMessagingService.stopTyping('recipient-1');
      expect(socketService.sendTypingStop).toHaveBeenCalledWith('recipient-1');
    });
  });

  describe('markAsRead', () => {
    it('should forward read receipt to socket', () => {
      signalMessagingService.markAsRead('msg-1', 'sender-1');
      expect(socketService.sendReadReceipt).toHaveBeenCalledWith('msg-1', 'sender-1');
    });
  });
});
