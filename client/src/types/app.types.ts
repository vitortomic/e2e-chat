export interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  username: string | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  decryptionFailed?: boolean;
  delivered?: boolean;
  messageType?: 'text' | 'image';
  imageData?: string; // base64 encoded image data (after decryption)
}

export interface Contact {
  id: string;
  username: string;
  isOnline?: boolean;
  lastMessage?: ChatMessage;
  unreadCount?: number;
}
