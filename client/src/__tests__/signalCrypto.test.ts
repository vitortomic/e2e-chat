import { describe, it, expect } from 'vitest';
import { arrayBufferToBase64, base64ToArrayBuffer } from '../utils/signalCrypto';

describe('signalCrypto', () => {
  describe('arrayBufferToBase64 / base64ToArrayBuffer', () => {
    it('should round-trip an empty buffer', () => {
      const original = new Uint8Array([]).buffer;
      const base64 = arrayBufferToBase64(original);
      const restored = base64ToArrayBuffer(base64);
      expect(new Uint8Array(restored)).toEqual(new Uint8Array(original));
    });

    it('should round-trip a small buffer', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const base64 = arrayBufferToBase64(original);
      const restored = base64ToArrayBuffer(base64);
      expect(new Uint8Array(restored)).toEqual(new Uint8Array(original));
    });

    it('should round-trip a buffer with all byte values', () => {
      const bytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        bytes[i] = i;
      }
      const base64 = arrayBufferToBase64(bytes.buffer);
      const restored = base64ToArrayBuffer(base64);
      expect(new Uint8Array(restored)).toEqual(bytes);
    });

    it('should round-trip a buffer simulating a 32-byte key', () => {
      const key = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        key[i] = Math.floor(Math.random() * 256);
      }
      const base64 = arrayBufferToBase64(key.buffer);
      const restored = base64ToArrayBuffer(base64);
      expect(new Uint8Array(restored)).toEqual(key);
    });

    it('should produce valid base64 output', () => {
      const data = new Uint8Array([72, 101, 108, 108, 111]).buffer; // "Hello"
      const base64 = arrayBufferToBase64(data);
      expect(base64).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    });

    it('should decode a known base64 string correctly', () => {
      // "SGVsbG8=" is base64 for "Hello"
      const result = base64ToArrayBuffer('SGVsbG8=');
      const decoded = new TextDecoder().decode(result);
      expect(decoded).toBe('Hello');
    });
  });
});
