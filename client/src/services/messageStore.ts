import type { ChatMessage } from '../types/app.types';

const DB_NAME = 'e2e-chat-messages';
const DB_VERSION = 1;
const STORE_NAME = 'messages';

/**
 * IndexedDB store for decrypted messages
 * Stores plaintext messages locally for message history persistence
 * This is necessary because Signal Protocol's forward secrecy prevents
 * re-decrypting messages after the session ratchet has advanced
 */
class MessageStore {
  private db: IDBDatabase | null = null;

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open message database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store for messages
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

          // Index for retrieving messages by conversation
          // Format: "userId1:userId2" where userId1 < userId2
          store.createIndex('conversationId', 'conversationId', { unique: false });

          // Index for retrieving messages by timestamp
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Get the conversation ID for two users (normalized order)
   */
  private getConversationId(userId1: string, userId2: string): string {
    return userId1 < userId2 ? `${userId1}:${userId2}` : `${userId2}:${userId1}`;
  }

  /**
   * Save a decrypted message to IndexedDB
   */
  async saveMessage(
    message: ChatMessage,
    currentUserId: string,
    otherUserId: string
  ): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const conversationId = this.getConversationId(currentUserId, otherUserId);

      const record = {
        ...message,
        conversationId,
        timestamp: message.timestamp instanceof Date
          ? message.timestamp.getTime()
          : new Date(message.timestamp).getTime(),
      };

      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Failed to save message:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all messages for a conversation
   */
  async getConversationMessages(currentUserId: string, otherUserId: string): Promise<ChatMessage[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('conversationId');

      const conversationId = this.getConversationId(currentUserId, otherUserId);
      const request = index.getAll(conversationId);

      request.onsuccess = () => {
        const messages = request.result.map((record: any) => ({
          ...record,
          timestamp: new Date(record.timestamp),
        }));

        // Sort by timestamp
        messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        resolve(messages);
      };

      request.onerror = () => {
        console.error('Failed to retrieve messages:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete all messages (e.g., on logout)
   */
  async clearAll(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Failed to clear messages:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete messages for a specific conversation
   */
  async clearConversation(currentUserId: string, otherUserId: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('conversationId');

      const conversationId = this.getConversationId(currentUserId, otherUserId);
      const request = index.openCursor(IDBKeyRange.only(conversationId));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        console.error('Failed to clear conversation:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Check if a message already exists (prevent duplicates)
   */
  async hasMessage(messageId: string): Promise<boolean> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(messageId);

      request.onsuccess = () => {
        resolve(request.result !== undefined);
      };

      request.onerror = () => {
        console.error('Failed to check message existence:', request.error);
        reject(request.error);
      };
    });
  }
}

export const messageStore = new MessageStore();
