/**
 * Secure Encryption Utilities using Web Crypto API
 * Uses AES-GCM for encryption with PBKDF2 key derivation
 */

/**
 * Derives an encryption key from a password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a string using AES-GCM
 * @param plaintext - The text to encrypt
 * @param password - The password for encryption
 * @returns Base64 encoded encrypted data (salt + iv + ciphertext)
 */
export async function encrypt(plaintext: string, password: string): Promise<string> {
  if (!plaintext) return '';
  if (!password) throw new Error('Password is required for encryption');
  
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );
  
  // Combine salt + iv + ciphertext
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a string encrypted with encrypt()
 * @param ciphertext - Base64 encoded encrypted data
 * @param password - The password for decryption
 * @returns The decrypted plaintext
 */
export async function decrypt(ciphertext: string, password: string): Promise<string> {
  if (!ciphertext) return '';
  if (!password) throw new Error('Password is required for decryption');
  
  try {
    // Validate base64 format
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(ciphertext)) {
      throw new Error('Invalid ciphertext format');
    }
    
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    
    // Minimum size: 16 (salt) + 12 (iv) + 16 (tag) = 44 bytes
    if (combined.length < 44) {
      throw new Error('Ciphertext too short');
    }
    
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);
    
    const key = await deriveKey(password, salt);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[Crypto] Decryption failed:', err);
    }
    throw new Error('Decryption failed - invalid key or corrupted data');
  }
}

/**
 * Generates a secure random key
 * @param length - Key length in bytes (default: 32)
 * @returns Hex encoded random key
 */
export function generateSecureKey(length: number = 32): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hashes data using SHA-256
 * @param data - Data to hash
 * @returns Hex encoded hash
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
