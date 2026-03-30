import {
  SignalProtocolAddress,
  SessionBuilder,
  SessionCipher,
} from '@privacyresearch/libsignal-protocol-typescript';
import { api } from './api';
import { socketService } from './socketService';
import { signalStore } from './signalProtocolStore';
import { base64ToArrayBuffer, arrayBufferToBase64 } from '../utils/signalCrypto';
import { DEVICE_ID, SignalMessageType, IMAGE_MAX_SIZE_BYTES } from '../constants';
import type { DecryptedMessage, IncomingMessage } from '../types';

class SignalMessagingService {
  private currentUserId: string | null = null;
  private initialized: boolean = false;

  initialize(userId: string): void {
    this.currentUserId = userId;
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Ensure a Signal Protocol session exists with the recipient.
   * If no session exists, fetches their pre-key bundle and establishes one via X3DH.
   */
  private async ensureSession(recipientId: string): Promise<SignalProtocolAddress> {
    const recipientAddress = new SignalProtocolAddress(recipientId, DEVICE_ID);
    const existingSession = await signalStore.loadSession(recipientAddress.toString());

    if (!existingSession) {
      const recipientKeys = await api.getUserPublicKeys(recipientId);

      const device = {
        identityKey: base64ToArrayBuffer(recipientKeys.publicKeys.identityKey),
        signedPreKey: {
          keyId: recipientKeys.publicKeys.signedPreKey.keyId,
          publicKey: base64ToArrayBuffer(recipientKeys.publicKeys.signedPreKey.publicKey),
          signature: base64ToArrayBuffer(recipientKeys.publicKeys.signedPreKey.signature),
        },
        preKey: recipientKeys.publicKeys.preKeys.length > 0 ? {
          keyId: recipientKeys.publicKeys.preKeys[0].keyId,
          publicKey: base64ToArrayBuffer(recipientKeys.publicKeys.preKeys[0].publicKey),
        } : undefined,
        registrationId: recipientKeys.registrationId,
      };

      const sessionBuilder = new SessionBuilder(signalStore, recipientAddress);
      await sessionBuilder.processPreKey(device);
    }

    return recipientAddress;
  }

  /**
   * Encrypt data with Signal Protocol and convert to base64 for transmission.
   */
  private async encryptAndSend(recipientId: string, plaintext: string): Promise<void> {
    if (!this.initialized || !this.currentUserId) {
      throw new Error('Messaging service not initialized');
    }

    const recipientAddress = await this.ensureSession(recipientId);
    const sessionCipher = new SessionCipher(signalStore, recipientAddress);

    const messageBuffer = new TextEncoder().encode(plaintext);
    const encryptedMessage = await sessionCipher.encrypt(messageBuffer.buffer);

    // Convert binary body to base64 for safe transmission
    const bodyBytes = new Uint8Array(encryptedMessage.body.length);
    for (let i = 0; i < encryptedMessage.body.length; i++) {
      bodyBytes[i] = encryptedMessage.body.charCodeAt(i);
    }
    const base64Body = arrayBufferToBase64(bodyBytes.buffer);

    socketService.sendMessage(recipientId, {
      ciphertext: base64Body,
      nonce: encryptedMessage.type.toString(),
      senderPublicKey: this.currentUserId,
    });
  }

  /**
   * Send encrypted text message
   */
  async sendMessage(recipientId: string, messageContent: string): Promise<void> {
    await this.encryptAndSend(recipientId, messageContent);
  }

  /**
   * Send encrypted image message
   */
  async sendImage(recipientId: string, imageBase64: string): Promise<void> {
    // Validate image size before encrypting
    const estimatedBytes = (imageBase64.length * 3) / 4;
    if (estimatedBytes > IMAGE_MAX_SIZE_BYTES) {
      throw new Error(`Image too large (${Math.round(estimatedBytes / 1024 / 1024)}MB). Maximum is ${IMAGE_MAX_SIZE_BYTES / 1024 / 1024}MB.`);
    }

    const messageData = JSON.stringify({ type: 'image', data: imageBase64 });
    await this.encryptAndSend(recipientId, messageData);
  }

  /**
   * Decrypt incoming message
   */
  async decryptIncomingMessage(message: IncomingMessage): Promise<DecryptedMessage> {
    try {
      const senderAddress = new SignalProtocolAddress(message.senderId, DEVICE_ID);
      const sessionCipher = new SessionCipher(signalStore, senderAddress);

      // Convert base64 ciphertext back to binary string format
      const ciphertextBytes = base64ToArrayBuffer(message.encryptedContent.ciphertext);
      const uint8Array = new Uint8Array(ciphertextBytes);

      // Convert to binary string in chunks to avoid stack overflow with large images
      let binaryString = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }

      let plaintext: ArrayBuffer;
      const messageType = parseInt(message.encryptedContent.nonce);

      if (messageType === SignalMessageType.PRE_KEY) {
        plaintext = await sessionCipher.decryptPreKeyWhisperMessage(binaryString);
      } else {
        plaintext = await sessionCipher.decryptWhisperMessage(binaryString);
      }

      const content = new TextDecoder().decode(plaintext);

      // Check if it's an image message
      try {
        const parsed = JSON.parse(content);
        if (parsed.type === 'image' && parsed.data) {
          return {
            id: message.id,
            senderId: message.senderId,
            content: '[Image]',
            timestamp: new Date(message.timestamp),
            messageType: 'image',
            imageData: parsed.data,
          };
        }
      } catch {
        // Not JSON, treat as text message
      }

      return {
        id: message.id,
        senderId: message.senderId,
        content,
        timestamp: new Date(message.timestamp),
        messageType: 'text',
      };
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      return {
        id: message.id,
        senderId: message.senderId,
        content: '[Failed to decrypt message]',
        timestamp: new Date(message.timestamp),
        decryptionFailed: true,
      };
    }
  }

  startTyping(recipientId: string): void {
    socketService.sendTypingStart(recipientId);
  }

  stopTyping(recipientId: string): void {
    socketService.sendTypingStop(recipientId);
  }

  markAsRead(messageId: string, senderId: string): void {
    socketService.sendReadReceipt(messageId, senderId);
  }

  clear(): void {
    this.currentUserId = null;
    this.initialized = false;
  }
}

export const signalMessagingService = new SignalMessagingService();
