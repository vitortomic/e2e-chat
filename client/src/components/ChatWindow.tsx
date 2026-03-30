import { useState, useEffect, useRef } from 'react';
import { signalMessagingService } from '../services/signalMessagingService';
import { socketService } from '../services/socketService';
import type { ChatMessage } from '../types/app.types';
import {
  IMAGE_MAX_SIZE_BYTES,
  IMAGE_MAX_DIMENSION,
  IMAGE_COMPRESSION_QUALITY,
  TYPING_TIMEOUT_MS,
} from '../constants';

interface ChatWindowProps {
  recipientId: string;
  recipientUsername: string;
  currentUserId: string;
  onBack?: () => void;
}

export function ChatWindow({ recipientId, recipientUsername, currentUserId, onBack }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [isContactOnline, setIsContactOnline] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [chatRequestSent, setChatRequestSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear messages when recipient changes and enter chat session
  useEffect(() => {
    setMessages([]);
    setIsContactOnline(false);
    setSessionActive(false);
    setChatRequestSent(false);

    socketService.enterChat(recipientId);

    socketService.getOnlineUsers((onlineUserIds) => {
      const isOnline = onlineUserIds.includes(recipientId);
      setIsContactOnline(isOnline);

      if (isOnline) {
        socketService.sendChatRequest(recipientId);
        setChatRequestSent(true);
      }
    });

    return () => {
      socketService.leaveChat(recipientId);
    };
  }, [recipientId]);

  useEffect(() => {
    const processedMessageIds = new Set<string>();

    const unsubscribe = socketService.onMessage(async (message) => {
      if (message.senderId === recipientId) {
        if (processedMessageIds.has(message.id)) {
          return;
        }

        processedMessageIds.add(message.id);

        const decrypted = await signalMessagingService.decryptIncomingMessage(message);
        setMessages((prev) => [...prev, decrypted]);

        signalMessagingService.markAsRead(message.id, message.senderId);
      }
    });

    const unsubTypingStart = socketService.onTypingStart((data) => {
      if (data.userId === recipientId) {
        setIsTyping(true);
      }
    });

    const unsubTypingStop = socketService.onTypingStop((data) => {
      if (data.userId === recipientId) {
        setIsTyping(false);
      }
    });

    const unsubOnline = socketService.onUserOnline((data) => {
      if (data.userId === recipientId) {
        setIsContactOnline(true);
      }
    });

    const unsubOffline = socketService.onUserOffline((data) => {
      if (data.userId === recipientId) {
        setIsContactOnline(false);
        setSessionActive(false);
      }
    });

    const unsubSessionStatus = socketService.onSessionStatus((data) => {
      if (data.recipientId === recipientId) {
        setSessionActive(data.sessionActive);
      }
    });

    const unsubUserEntered = socketService.onUserEntered((data) => {
      if (data.userId === recipientId) {
        setSessionActive(data.sessionActive);
      }
    });

    const unsubUserLeft = socketService.onUserLeft((data) => {
      if (data.userId === recipientId) {
        setSessionActive(data.sessionActive);
      }
    });

    return () => {
      unsubscribe();
      unsubTypingStart();
      unsubTypingStop();
      unsubOnline();
      unsubOffline();
      unsubSessionStatus();
      unsubUserEntered();
      unsubUserLeft();
    };
  }, [recipientId]);

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputText.trim() || sending || !sessionActive) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    signalMessagingService.stopTyping(recipientId);

    try {
      const sentMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        senderId: currentUserId,
        content: messageText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, sentMessage]);

      await signalMessagingService.sendMessage(recipientId, messageText);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);

    if (text.trim()) {
      signalMessagingService.startTyping(recipientId);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        signalMessagingService.stopTyping(recipientId);
      }, TYPING_TIMEOUT_MS);
    } else {
      signalMessagingService.stopTyping(recipientId);
    }
  };

  const handleAttachmentClick = () => {
    if (!sessionActive || sending) return;
    fileInputRef.current?.click();
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > IMAGE_MAX_DIMENSION) {
              height = (height * IMAGE_MAX_DIMENSION) / width;
              width = IMAGE_MAX_DIMENSION;
            }
          } else {
            if (height > IMAGE_MAX_DIMENSION) {
              width = (width * IMAGE_MAX_DIMENSION) / height;
              height = IMAGE_MAX_DIMENSION;
            }
          }

          canvas.width = width;
          canvas.height = height;

          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', IMAGE_COMPRESSION_QUALITY);
          resolve(compressedBase64);
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionActive || sending) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > IMAGE_MAX_SIZE_BYTES) {
      alert(`Image too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum is ${IMAGE_MAX_SIZE_BYTES / 1024 / 1024}MB.`);
      return;
    }

    setSending(true);

    try {
      const compressedBase64 = await compressImage(file);

      const tempMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        senderId: currentUserId,
        content: '[Image]',
        timestamp: new Date(),
        messageType: 'image',
        imageData: compressedBase64,
      };

      setMessages((prev) => [...prev, tempMessage]);

      await signalMessagingService.sendImage(recipientId, compressedBase64);
    } catch (error) {
      console.error('Failed to send image:', error);
      alert(error instanceof Error ? error.message : 'Failed to send image');
    } finally {
      setSending(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerRow}>
          {onBack && (
            <button onClick={onBack} style={styles.backButton}>
              ←
            </button>
          )}
          <h2 style={styles.headerTitle}>{recipientUsername}</h2>
        </div>
        {isTyping && <span style={styles.typing}>typing...</span>}
      </div>

      <div style={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                ...styles.message,
                ...(msg.senderId === currentUserId
                  ? styles.messageOwn
                  : styles.messageOther),
              }}
            >
              {msg.messageType === 'image' && msg.imageData ? (
                <div style={styles.messageContent}>
                  <img
                    src={msg.imageData}
                    alt="Sent image"
                    style={styles.messageImage}
                  />
                  <div style={styles.messageTime}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ) : (
                <>
                  <div style={styles.messageContent}>
                    {msg.content}
                    {msg.decryptionFailed && (
                      <span style={styles.decryptionError}> (decryption failed)</span>
                    )}
                  </div>
                  <div style={styles.messageTime}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {sessionActive ? (
        <form onSubmit={handleSend} style={styles.inputContainer}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={styles.fileInput}
          />
          <button
            type="button"
            onClick={handleAttachmentClick}
            style={styles.attachButton}
            disabled={sending}
            title="Attach image"
          >
            +
          </button>
          <input
            type="text"
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Type a message..."
            style={styles.input}
            disabled={sending}
          />
          <button type="submit" style={styles.sendButton} disabled={sending || !inputText.trim()}>
            {sending ? '...' : 'Send'}
          </button>
        </form>
      ) : (
        <div style={styles.offlineContainer}>
          <div style={styles.offlineMessage}>
            {!isContactOnline
              ? `Waiting for ${recipientUsername} to come online...`
              : `Waiting for ${recipientUsername} to open this chat...`
            }
          </div>
          {isContactOnline && chatRequestSent && (
            <div style={styles.sessionInfo}>
              Chat request sent. Messages can only be sent when both users are in the chat (forward secrecy).
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    background: 'white',
  },
  header: {
    padding: '20px',
    borderBottom: '2px solid #e0e0e0',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  backButton: {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    color: 'white',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px 10px',
    borderRadius: '6px',
    lineHeight: 1,
  },
  headerTitle: {
    margin: 0,
    fontSize: '20px',
  },
  typing: {
    fontSize: '12px',
    opacity: 0.8,
    fontStyle: 'italic' as const,
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  emptyState: {
    textAlign: 'center' as const,
    color: '#999',
    marginTop: '50px',
  },
  message: {
    maxWidth: '70%',
    padding: '12px 16px',
    borderRadius: '18px',
    wordWrap: 'break-word' as const,
  },
  messageOwn: {
    alignSelf: 'flex-end',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
  },
  messageOther: {
    alignSelf: 'flex-start',
    background: '#f0f0f0',
    color: '#333',
  },
  messageContent: {
    marginBottom: '4px',
  },
  messageTime: {
    fontSize: '10px',
    opacity: 0.7,
  },
  decryptionError: {
    fontSize: '12px',
    opacity: 0.7,
  },
  messageImage: {
    width: '200px',
    height: 'auto',
    maxHeight: '200px',
    borderRadius: '12px',
    objectFit: 'cover' as const,
    display: 'block',
    marginBottom: '4px',
  },
  inputContainer: {
    display: 'flex',
    gap: '10px',
    padding: '20px',
    borderTop: '2px solid #e0e0e0',
    alignItems: 'center',
  },
  fileInput: {
    display: 'none',
  },
  attachButton: {
    width: '40px',
    height: '40px',
    fontSize: '24px',
    background: 'transparent',
    border: '2px solid #e0e0e0',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
  input: {
    flex: 1,
    padding: '12px',
    fontSize: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '24px',
    outline: 'none',
  },
  sendButton: {
    padding: '12px 24px',
    fontSize: '16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '24px',
    cursor: 'pointer',
  },
  offlineContainer: {
    padding: '20px',
    borderTop: '2px solid #e0e0e0',
    background: '#f5f5f5',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
  },
  offlineMessage: {
    color: '#666',
    fontSize: '14px',
    fontStyle: 'italic' as const,
  },
  sessionInfo: {
    color: '#667eea',
    fontSize: '12px',
    textAlign: 'center' as const,
    maxWidth: '80%',
  },
};
