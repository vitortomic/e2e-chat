import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { signalMessagingService } from '../services/signalMessagingService';
import { socketService } from '../services/socketService';
import { api } from '../services/api';
import { TYPING_TIMEOUT_MS, IMAGE_MAX_SIZE_BYTES } from '../constants';
import type { DecryptedMessage, IncomingMessage } from '../types';

interface ChatScreenProps {
  route: {
    params: {
      contactId: string;
      contactName: string;
      isOnline?: boolean;
    };
  };
  navigation: any;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const { contactId, contactName, isOnline: initialOnline } = route.params;
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isContactOnline, setIsContactOnline] = useState(initialOnline || false);
  const [sessionActive, setSessionActive] = useState(false);
  const [chatRequestSent, setChatRequestSent] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageCounterRef = useRef(0);

  useEffect(() => {
    loadMessages();
    setupSocketListeners();

    // Set navigation title
    navigation.setOptions({ title: contactName });

    // Enter this chat session
    socketService.enterChat(contactId);

    // Check if contact is currently online and send chat request
    socketService.getOnlineUsers((data: { userIds: string[] }) => {
      const isOnline = data.userIds.includes(contactId);
      setIsContactOnline(isOnline);

      // Send chat request to notify the other user if they're online
      if (isOnline) {
        socketService.sendChatRequest(contactId);
        setChatRequestSent(true);
      }
    });

    return () => {
      // Stop typing indicator when leaving
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      signalMessagingService.stopTyping(contactId);

      // Leave chat session
      socketService.leaveChat(contactId);
    };
  }, [contactId, contactName]);

  const loadMessages = async () => {
    try {
      const currentUser = await api.getCurrentUser();
      setCurrentUserId(currentUser.id);
      // No message history - messages are only in memory during session
    } catch (error) {
      console.error('Failed to load user info:', error);
      Alert.alert('Error', 'Failed to load user information');
    }
  };

  const setupSocketListeners = () => {
    const processedMessageIds = new Set<string>();

    // Listen for incoming messages
    socketService.onMessage(async (incomingMessage: IncomingMessage) => {
      if (incomingMessage.senderId === contactId) {
        // Check if message already processed (prevent duplicates and replay attacks)
        if (processedMessageIds.has(incomingMessage.id)) {
          return;
        }

        processedMessageIds.add(incomingMessage.id);

        try {
          // Decrypt message
          const decryptedMessage = await signalMessagingService.decryptIncomingMessage(
            incomingMessage
          );

          // Add to message list
          setMessages(prev => [...prev, decryptedMessage]);

          // Send read receipt
          signalMessagingService.markAsRead(incomingMessage.id, contactId);
        } catch (error) {
          console.error('Failed to decrypt message:', error);
        }
      }
    });

    // Listen for online/offline status
    socketService.onUserOnline((data: { userId: string }) => {
      if (data.userId === contactId) {
        setIsContactOnline(true);
      }
    });

    socketService.onUserOffline((data: { userId: string }) => {
      if (data.userId === contactId) {
        setIsContactOnline(false);
        setSessionActive(false);
      }
    });

    // Listen for typing indicators
    socketService.onTypingStart((data: { userId: string }) => {
      if (data.userId === contactId) {
        setIsTyping(true);
      }
    });

    socketService.onTypingStop((data: { userId: string }) => {
      if (data.userId === contactId) {
        setIsTyping(false);
      }
    });

    // Listen for session status changes
    socketService.onSessionStatus((data: { recipientId: string; sessionActive: boolean }) => {
      if (data.recipientId === contactId) {
        setSessionActive(data.sessionActive);
      }
    });

    socketService.onUserEntered((data: { userId: string; sessionActive: boolean }) => {
      if (data.userId === contactId) {
        setSessionActive(data.sessionActive);
      }
    });

    socketService.onUserLeft((data: { userId: string; sessionActive: boolean }) => {
      if (data.userId === contactId) {
        setSessionActive(data.sessionActive);
      }
    });
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending || !sessionActive) return;

    setSending(true);
    setInputText('');

    try {
      // Create optimistic message for UI with unique ID
      messageCounterRef.current += 1;
      const tempMessage: DecryptedMessage = {
        id: `temp-${currentUserId}-${Date.now()}-${messageCounterRef.current}`,
        senderId: currentUserId,
        content: text,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, tempMessage]);

      // Send encrypted message
      await signalMessagingService.sendMessage(contactId, text);

      // Stop typing indicator
      signalMessagingService.stopTyping(contactId);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);

    // Send typing indicator
    if (text.length > 0) {
      signalMessagingService.startTyping(contactId);

      // Reset typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        signalMessagingService.stopTyping(contactId);
      }, TYPING_TIMEOUT_MS);
    } else {
      signalMessagingService.stopTyping(contactId);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleImagePick = async () => {
    if (!sessionActive || sending) return;

    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.5,
        maxWidth: 800,
        maxHeight: 800,
        includeBase64: true,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert('Error', 'Failed to read image data');
        return;
      }

      // Validate image size
      const estimatedBytes = (asset.base64.length * 3) / 4;
      if (estimatedBytes > IMAGE_MAX_SIZE_BYTES) {
        Alert.alert('Error', `Image too large (${Math.round(estimatedBytes / 1024 / 1024)}MB). Maximum is ${IMAGE_MAX_SIZE_BYTES / 1024 / 1024}MB.`);
        return;
      }

      setSending(true);

      // Create optimistic message for UI
      messageCounterRef.current += 1;
      const tempMessage: DecryptedMessage = {
        id: `temp-${currentUserId}-${Date.now()}-${messageCounterRef.current}`,
        senderId: currentUserId,
        content: '[Image]',
        timestamp: new Date(),
        messageType: 'image',
        imageData: `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`,
      };

      setMessages(prev => [...prev, tempMessage]);

      // Send encrypted image
      await signalMessagingService.sendImage(contactId, tempMessage.imageData);
    } catch (error) {
      console.error('Failed to send image:', error);
      Alert.alert('Error', 'Failed to send image');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: DecryptedMessage }) => {
    const isOwnMessage = item.senderId === currentUserId;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownBubble : styles.otherBubble,
          ]}
        >
          {item.messageType === 'image' && item.imageData ? (
            <Image
              source={{ uri: item.imageData }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          ) : (
            <Text
              style={[
                styles.messageText,
                isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
                item.decryptionFailed && styles.failedMessageText,
              ]}
            >
              {item.content}
            </Text>
          )}
          <Text
            style={[
              styles.timestamp,
              isOwnMessage ? styles.ownTimestamp : styles.otherTimestamp,
            ]}
          >
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item, index) => item.id || `message-${index}`}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start the conversation!</Text>
          </View>
        }
      />

      {isTyping && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>{contactName} is typing...</Text>
        </View>
      )}

      {sessionActive ? (
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handleImagePick}
            disabled={sending}
          >
            <Text style={styles.attachButtonText}>📎</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={handleInputChange}
            placeholder="Type a message..."
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.offlineContainer}>
          <Text style={styles.offlineText}>
            {!isContactOnline
              ? `Waiting for ${contactName} to come online...`
              : `Waiting for ${contactName} to open this chat...`}
          </Text>
          {isContactOnline && chatRequestSent && (
            <Text style={styles.sessionInfoText}>
              💬 Chat request sent. Messages can only be sent when both users are in the chat (forward secrecy).
            </Text>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messageList: {
    padding: 15,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
  },
  messageContainer: {
    marginVertical: 5,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
  },
  ownBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#000',
  },
  failedMessageText: {
    fontStyle: 'italic',
    color: '#ff3b30',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  ownTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  otherTimestamp: {
    color: '#999',
  },
  typingContainer: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
  },
  typingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  attachButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  attachButtonText: {
    fontSize: 24,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 10,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  sendButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 40,
  },
  sendButtonDisabled: {
    backgroundColor: '#c7c7cc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  offlineContainer: {
    padding: 20,
    backgroundColor: '#fff8e1',
    borderTopWidth: 1,
    borderTopColor: '#ffecb3',
    alignItems: 'center',
  },
  offlineText: {
    fontSize: 16,
    color: '#f57c00',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  sessionInfoText: {
    fontSize: 12,
    color: '#7c3aed',
    textAlign: 'center',
    marginTop: 4,
  },
});
