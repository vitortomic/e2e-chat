import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DecryptedMessage } from '../types';

/**
 * Message storage service using AsyncStorage
 * Stores decrypted message history locally
 */

const MESSAGES_KEY_PREFIX = 'messages_';

/**
 * Generate storage key for a conversation
 */
function getConversationKey(userId1: string, userId2: string): string {
  // Sort user IDs to ensure consistent key regardless of order
  const [user1, user2] = [userId1, userId2].sort();
  return `${MESSAGES_KEY_PREFIX}${user1}_${user2}`;
}

export const messageStore = {
  /**
   * Save a message to conversation history
   */
  async saveMessage(
    message: DecryptedMessage,
    currentUserId: string,
    otherUserId: string
  ): Promise<void> {
    try {
      const key = getConversationKey(currentUserId, otherUserId);
      const existing = await this.getConversationMessages(currentUserId, otherUserId);

      // Append new message
      const updated = [...existing, message];

      await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  },

  /**
   * Get all messages for a conversation
   */
  async getConversationMessages(
    userId1: string,
    userId2: string
  ): Promise<DecryptedMessage[]> {
    try {
      const key = getConversationKey(userId1, userId2);
      const data = await AsyncStorage.getItem(key);

      if (!data) {
        return [];
      }

      const messages = JSON.parse(data);

      // Convert timestamp strings back to Date objects
      return messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
    } catch (error) {
      console.error('Error getting conversation messages:', error);
      return [];
    }
  },

  /**
   * Clear all messages for a conversation
   */
  async clearConversation(userId1: string, userId2: string): Promise<void> {
    try {
      const key = getConversationKey(userId1, userId2);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing conversation:', error);
      throw error;
    }
  },

  /**
   * Clear all messages
   */
  async clearAllMessages(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const messageKeys = keys.filter(key => key.startsWith(MESSAGES_KEY_PREFIX));
      await AsyncStorage.multiRemove(messageKeys);
    } catch (error) {
      console.error('Error clearing all messages:', error);
      throw error;
    }
  },

  /**
   * Get all conversations (for listing recent chats)
   */
  async getAllConversations(): Promise<Array<{ userId: string; lastMessage: DecryptedMessage }>> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const messageKeys = keys.filter(key => key.startsWith(MESSAGES_KEY_PREFIX));

      const conversations = await Promise.all(
        messageKeys.map(async (key) => {
          const data = await AsyncStorage.getItem(key);
          if (!data) return null;

          const messages = JSON.parse(data);
          if (messages.length === 0) return null;

          const lastMessage = messages[messages.length - 1];

          // Extract user IDs from key
          const userIds = key.replace(MESSAGES_KEY_PREFIX, '').split('_');

          return {
            userId: userIds[1] || userIds[0], // Return the other user's ID
            lastMessage: {
              ...lastMessage,
              timestamp: new Date(lastMessage.timestamp),
            },
          };
        })
      );

      return conversations.filter(Boolean) as Array<{ userId: string; lastMessage: DecryptedMessage }>;
    } catch (error) {
      console.error('Error getting all conversations:', error);
      return [];
    }
  },
};
