export interface EncryptedMessage {
  ciphertext: string; // base64 encoded encrypted data
  nonce: string; // Signal Protocol message type (3 = PreKey, 1 = regular)
  senderPublicKey: string; // sender's user ID
}
