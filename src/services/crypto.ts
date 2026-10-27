// src/services/crypto.ts - Cryptographic operations, AES-256-GCM encryption & masking

/**
 * Returns the WebCrypto SubtleCrypto implementation available in the environment.
 * Standard WebCrypto is supported in React Native (Expo 51+), Node 18+, and Modern Browsers.
 */
function getCrypto(): Crypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  try {
    // Fallback for Node.js test environment if needed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    return nodeCrypto.webcrypto as Crypto;
  } catch {
    throw new Error('WebCrypto API is not available in this environment');
  }
}

/**
 * Encodes an ArrayBuffer to a Base64 string safely.
 */
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  // Fallback for Node.js
  return Buffer.from(binary, 'binary').toString('base64');
}

/**
 * Decodes a Base64 string to a Uint8Array safely.
 */
export function base64ToBuffer(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // Fallback for Node.js
  const buf = Buffer.from(base64, 'base64');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * Derives an AES-GCM CryptoKey from a passphrase and salt using PBKDF2 (100,000 iterations).
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const cryptoObj = getCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await cryptoObj.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns { ciphertext: base64, iv: base64, salt: base64 }.
 */
export async function encryptText(
  plaintext: string,
  passphrase: string
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const cryptoObj = getCrypto();
  const encoder = new TextEncoder();

  // Generate 16 bytes salt for PBKDF2
  const salt = new Uint8Array(16);
  cryptoObj.getRandomValues(salt);

  // Generate 12 bytes IV for AES-GCM
  const iv = new Uint8Array(12);
  cryptoObj.getRandomValues(iv);

  const key = await deriveKeyFromPassphrase(passphrase, salt);

  const encryptedBuffer = await cryptoObj.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv.buffer),
    salt: bufferToBase64(salt.buffer),
  };
}

/**
 * Decrypts AES-256-GCM ciphertext using the given passphrase, IV, and salt.
 */
export async function decryptText(
  ciphertextBase64: string,
  ivBase64: string,
  saltBase64: string,
  passphrase: string
): Promise<string> {
  const cryptoObj = getCrypto();
  const decoder = new TextDecoder();

  const salt = base64ToBuffer(saltBase64);
  const iv = base64ToBuffer(ivBase64);
  const ciphertext = base64ToBuffer(ciphertextBase64);

  const key = await deriveKeyFromPassphrase(passphrase, salt);

  const decryptedBuffer = await cryptoObj.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    ciphertext
  );

  return decoder.decode(decryptedBuffer);
}

/**
 * Computes SHA-256 checksum of any string data (for backup integrity verification).
 */
export async function computeSHA256Checksum(data: string): Promise<string> {
  const cryptoObj = getCrypto();
  const encoder = new TextEncoder();
  const hashBuffer = await cryptoObj.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Masks a credit card number by default to protect sensitive PAN.
 * Example: "4111222233334444" -> "•••• •••• •••• 4444"
 */
export function maskCardNumber(cardNumber: string | null | undefined, lastFour?: string): string {
  if (lastFour && lastFour.length === 4) {
    return `•••• •••• •••• ${lastFour}`;
  }
  if (!cardNumber) {
    return '•••• •••• •••• ••••';
  }
  const clean = cardNumber.replace(/\D/g, '');
  if (clean.length < 4) {
    return '•••• •••• •••• ••••';
  }
  const last4 = clean.slice(-4);
  return `•••• •••• •••• ${last4}`;
}

/**
 * Formats a 16-digit card number with spacing for display when unlocked.
 * Example: "4111222233334444" -> "4111 2222 3333 4444"
 */
export function formatFullCardNumber(cardNumber: string): string {
  const clean = cardNumber.replace(/\D/g, '');
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    chunks.push(clean.slice(i, i + 4));
  }
  return chunks.join(' ');
}

/**
 * Extracts last four digits safely from a card number.
 */
export function extractLastFourDigits(cardNumber: string): string {
  const clean = cardNumber.replace(/\D/g, '');
  if (clean.length >= 4) {
    return clean.slice(-4);
  }
  return clean.padStart(4, '0');
}
