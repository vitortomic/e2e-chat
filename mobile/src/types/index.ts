// API Types
export interface User {
  id: string;
  username: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  publicKeys: {
    identityKey: string;
    signedPreKey: {
      keyId: number;
      publicKey: string;
      signature: string;
      timestamp: number;
    };
    preKeys: Array<{
      keyId: number;
      publicKey: string;
    }>;
    registrationId: number;
    deviceId: number;
  };
}

export interface RegisterResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface UserPublicKeys {
  publicKeys: {
    identityKey: string;
    signedPreKey: {
      keyId: number;
      publicKey: string;
      signature: string;
      timestamp: number;
    };
    preKeys: Array<{
      keyId: number;
      publicKey: string;
    }>;
  };
  registrationId: number;
  deviceId: number;
}

// Encrypted Message Types
export interface EncryptedMessage {
  ciphertext: string; // base64 encoded encrypted data
  nonce: string; // Message type as string (3 = PreKey, 1 = regular)
  senderPublicKey: string; // userId as identifier
}

export interface IncomingMessage {
  id: string;
  senderId: string;
  encryptedContent: EncryptedMessage;
  timestamp: Date;
}

export interface DecryptedMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  decryptionFailed?: boolean;
  messageType?: 'text' | 'image';
  imageData?: string; // base64 encoded image data (after decryption)
}

// Contact Types
export interface Contact extends User {
  isOnline?: boolean;
  isTyping?: boolean;
  lastMessage?: string;
  lastMessageTime?: Date;
  hasChatRequest?: boolean;
}
