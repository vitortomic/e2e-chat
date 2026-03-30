import { io, Socket } from 'socket.io-client';
import type { EncryptedMessage } from '../types/crypto.types';
import { SocketEvents } from '../constants';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api$/, '');

export interface IncomingMessage {
  id: string;
  senderId: string;
  encryptedContent: EncryptedMessage;
  timestamp: Date;
}

export type MessageHandler = (message: IncomingMessage) => void;
export type StatusHandler = (data: { userId: string }) => void;
export type TypingHandler = (data: { userId: string }) => void;
export type DeliveryHandler = (data: { messageId: string; recipientId: string }) => void;
export type SessionStatusHandler = (data: { recipientId: string; sessionActive: boolean }) => void;
export type ChatRequestHandler = (data: { fromUserId: string; timestamp: Date }) => void;
export type UserEnteredHandler = (data: { userId: string; sessionActive: boolean }) => void;

class SocketService {
  private socket: Socket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private onlineHandlers: Set<StatusHandler> = new Set();
  private offlineHandlers: Set<StatusHandler> = new Set();
  private typingStartHandlers: Set<TypingHandler> = new Set();
  private typingStopHandlers: Set<TypingHandler> = new Set();
  private deliveryHandlers: Set<DeliveryHandler> = new Set();
  private sessionStatusHandlers: Set<SessionStatusHandler> = new Set();
  private chatRequestHandlers: Set<ChatRequestHandler> = new Set();
  private userEnteredHandlers: Set<UserEnteredHandler> = new Set();
  private userLeftHandlers: Set<UserEnteredHandler> = new Set();
  private pendingMessagesBuffer: IncomingMessage[] = [];

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(SOCKET_URL, {
        auth: { token },
      });

      this.socket.on('connect', () => {
        this.setupEventListeners();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', () => {
        // WebSocket disconnected
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on(SocketEvents.MESSAGE_RECEIVE, (data: IncomingMessage) => {
      this.messageHandlers.forEach(handler => handler(data));
    });

    this.socket.on(SocketEvents.MESSAGES_PENDING, (data: { messages: IncomingMessage[] }) => {
      if (this.messageHandlers.size > 0) {
        data.messages.forEach(msg => {
          this.messageHandlers.forEach(handler => handler(msg));
        });
      } else {
        this.pendingMessagesBuffer.push(...data.messages);
      }
    });

    this.socket.on(SocketEvents.USER_ONLINE, (data: { userId: string }) => {
      this.onlineHandlers.forEach(handler => handler(data));
    });

    this.socket.on(SocketEvents.USER_OFFLINE, (data: { userId: string }) => {
      this.offlineHandlers.forEach(handler => handler(data));
    });

    this.socket.on(SocketEvents.TYPING_START, (data: { userId: string }) => {
      this.typingStartHandlers.forEach(handler => handler(data));
    });

    this.socket.on(SocketEvents.TYPING_STOP, (data: { userId: string }) => {
      this.typingStopHandlers.forEach(handler => handler(data));
    });

    this.socket.on(SocketEvents.MESSAGE_DELIVERED, (data: { messageId: string; recipientId: string }) => {
      this.deliveryHandlers.forEach(handler => handler(data));
    });

    this.socket.on(SocketEvents.MESSAGE_QUEUED, () => {
      // Message queued for offline delivery
    });

    this.socket.on(SocketEvents.CHAT_SESSION_STATUS, (data: { recipientId: string; sessionActive: boolean }) => {
      this.sessionStatusHandlers.forEach(handler => handler(data));
    });

    this.socket.on(SocketEvents.CHAT_REQUEST_RECEIVED, (data: { fromUserId: string; timestamp: Date }) => {
      this.chatRequestHandlers.forEach(handler => handler(data));
    });

    this.socket.on(SocketEvents.CHAT_USER_ENTERED, (data: { userId: string; sessionActive: boolean }) => {
      this.userEnteredHandlers.forEach(handler => handler(data));
    });

    this.socket.on(SocketEvents.CHAT_USER_LEFT, (data: { userId: string; sessionActive: boolean }) => {
      this.userLeftHandlers.forEach(handler => handler(data));
    });

    this.socket.on('error', (error: { message: string }) => {
      console.error('Socket error:', error.message);
    });
  }

  sendMessage(recipientId: string, encryptedContent: EncryptedMessage): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    this.socket.emit(SocketEvents.MESSAGE_SEND, {
      recipientId,
      encryptedContent,
    });
  }

  sendTypingStart(recipientId: string): void {
    if (!this.socket) return;
    this.socket.emit(SocketEvents.TYPING_START, { recipientId });
  }

  sendTypingStop(recipientId: string): void {
    if (!this.socket) return;
    this.socket.emit(SocketEvents.TYPING_STOP, { recipientId });
  }

  sendReadReceipt(messageId: string, senderId: string): void {
    if (!this.socket) return;
    this.socket.emit(SocketEvents.MESSAGE_READ, { messageId, senderId });
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);

    if (this.pendingMessagesBuffer.length > 0) {
      this.pendingMessagesBuffer.forEach(msg => handler(msg));
      this.pendingMessagesBuffer = [];
    }

    return () => this.messageHandlers.delete(handler);
  }

  onUserOnline(handler: StatusHandler): () => void {
    this.onlineHandlers.add(handler);
    return () => this.onlineHandlers.delete(handler);
  }

  onUserOffline(handler: StatusHandler): () => void {
    this.offlineHandlers.add(handler);
    return () => this.offlineHandlers.delete(handler);
  }

  onTypingStart(handler: TypingHandler): () => void {
    this.typingStartHandlers.add(handler);
    return () => this.typingStartHandlers.delete(handler);
  }

  onTypingStop(handler: TypingHandler): () => void {
    this.typingStopHandlers.add(handler);
    return () => this.typingStopHandlers.delete(handler);
  }

  onDelivery(handler: DeliveryHandler): () => void {
    this.deliveryHandlers.add(handler);
    return () => this.deliveryHandlers.delete(handler);
  }

  getOnlineUsers(callback: (userIds: string[]) => void): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    this.socket.once(SocketEvents.USERS_ONLINE_LIST, (data: { userIds: string[] }) => {
      callback(data.userIds);
    });

    this.socket.emit(SocketEvents.USERS_GET_ONLINE);
  }

  enterChat(recipientId: string): void {
    if (!this.socket) return;
    this.socket.emit(SocketEvents.CHAT_ENTER, { recipientId });
  }

  leaveChat(recipientId: string): void {
    if (!this.socket) return;
    this.socket.emit(SocketEvents.CHAT_LEAVE, { recipientId });
  }

  sendChatRequest(recipientId: string): void {
    if (!this.socket) return;
    this.socket.emit(SocketEvents.CHAT_REQUEST, { recipientId });
  }

  onSessionStatus(handler: SessionStatusHandler): () => void {
    this.sessionStatusHandlers.add(handler);
    return () => this.sessionStatusHandlers.delete(handler);
  }

  onChatRequest(handler: ChatRequestHandler): () => void {
    this.chatRequestHandlers.add(handler);
    return () => this.chatRequestHandlers.delete(handler);
  }

  onUserEntered(handler: UserEnteredHandler): () => void {
    this.userEnteredHandlers.add(handler);
    return () => this.userEnteredHandlers.delete(handler);
  }

  onUserLeft(handler: UserEnteredHandler): () => void {
    this.userLeftHandlers.add(handler);
    return () => this.userLeftHandlers.delete(handler);
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
