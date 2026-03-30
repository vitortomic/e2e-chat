// Socket.IO event names
export const SocketEvents = {
  // Outgoing (client → server)
  MESSAGE_SEND: 'message:send',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  MESSAGE_READ: 'message:read',
  USERS_GET_ONLINE: 'users:get-online',
  CHAT_ENTER: 'chat:enter',
  CHAT_LEAVE: 'chat:leave',
  CHAT_REQUEST: 'chat:request',

  // Incoming (server → client)
  MESSAGE_RECEIVE: 'message:receive',
  MESSAGES_PENDING: 'messages:pending',
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  MESSAGE_DELIVERED: 'message:delivered',
  MESSAGE_QUEUED: 'message:queued',
  CHAT_SESSION_STATUS: 'chat:session-status',
  CHAT_REQUEST_RECEIVED: 'chat:request-received',
  CHAT_USER_ENTERED: 'chat:user-entered',
  CHAT_USER_LEFT: 'chat:user-left',
  USERS_ONLINE_LIST: 'users:online-list',
} as const;

// Signal Protocol constants
export const DEVICE_ID = 1;
export const PRE_KEY_COUNT = 20;
export const PRE_KEY_START_ID = 1;
export const SIGNED_PRE_KEY_ID = 1;

// Signal Protocol message types
export const SignalMessageType = {
  WHISPER: 1,
  PRE_KEY: 3,
} as const;

// IndexedDB database names
export const DB_NAMES = {
  SIGNAL_STORE: 'signal-protocol-store',
  MESSAGES: 'e2e-chat-messages',
} as const;

// IndexedDB store names for Signal Protocol
export const SignalStoreNames = {
  IDENTITY: 'identity',
  PRE_KEYS: 'preKeys',
  SIGNED_PRE_KEYS: 'signedPreKeys',
  SESSIONS: 'sessions',
  IDENTITY_KEYS: 'identityKeys',
} as const;

// Image constraints
export const IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB before compression
export const IMAGE_MAX_DIMENSION = 800;
export const IMAGE_COMPRESSION_QUALITY = 0.7;

// Typing indicator timeout (ms)
export const TYPING_TIMEOUT_MS = 2000;

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
} as const;
