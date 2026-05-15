/**
 * Encrypted Storage Module
 * 
 * Provides encrypted localStorage for sensitive data
 * Uses AES encryption from crypto-js
 * 
 * Installation:
 * npm install crypto-js
 * npm install --save-dev @types/crypto-js
 */

import CryptoJS from 'crypto-js';

/**
 * Generate a device-specific key based on browser fingerprint
 * This key is derived from device characteristics
 */
const generateDeviceKey = (): string => {
  // مفتاح مشتق من خصائص الجهاز
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    screen.width,
    screen.height,
    typeof window.localStorage,
  ].join('|');
  
  return CryptoJS.SHA256(fingerprint).toString().substring(0, 32);
};

const DEVICE_KEY = generateDeviceKey();
const ENCRYPTION_SALT = 'mohafadaty-secure'; // يجب تغييره على مستوى الإنتاج

/**
 * Encrypted Storage Service
 * 
 * Encrypts sensitive data before storing in localStorage
 * Automatically decrypts when retrieving
 */
export const encryptedStorage = {
  /**
   * Encrypt and store data
   * 
   * @param key - Storage key
   * @param value - Value to encrypt and store
   * 
   * @example
   * encryptedStorage.setItem('turso_token', 'my-secret-token');
   */
  setItem: (key: string, value: string): void => {
    try {
      // مفتاح يحتوي على الملح
      const encryptionKey = DEVICE_KEY + ENCRYPTION_SALT + key;
      
      // تشفير القيمة
      const encrypted = CryptoJS.AES.encrypt(value, encryptionKey).toString();
      
      // إضافة metadata للتحقق من الصحة
      const payload = {
        v: 1, // version
        d: encrypted, // data
        t: Date.now(), // timestamp
      };
      
      // حفظ في localStorage
      localStorage.setItem(`enc_${key}`, JSON.stringify(payload));
    } catch (error) {
      console.error(`[EncryptedStorage] Failed to encrypt ${key}:`, error);
      // fallback: حفظ بدون تشفير (في حالة الفشل)
      localStorage.setItem(`enc_${key}`, value);
    }
  },

  /**
   * Retrieve and decrypt data
   * 
   * @param key - Storage key
   * @returns - Decrypted value or null if not found
   * 
   * @example
   * const token = encryptedStorage.getItem('turso_token');
   */
  getItem: (key: string): string | null => {
    try {
      const encrypted = localStorage.getItem(`enc_${key}`);
      if (!encrypted) return null;
      
      // محاولة فك تشفير إذا كانت البيانات بصيغة JSON
      let payload;
      try {
        payload = JSON.parse(encrypted);
      } catch {
        // إذا لم تكن JSON، فهي بيانات قديمة بدون تشفير
        return encrypted;
      }
      
      // التحقق من الصيغة
      if (!payload.v || !payload.d) {
        return null;
      }
      
      // فك التشفير
      const encryptionKey = DEVICE_KEY + ENCRYPTION_SALT + key;
      const decrypted = CryptoJS.AES.decrypt(payload.d, encryptionKey).toString(
        CryptoJS.enc.Utf8
      );
      
      if (!decrypted) {
        console.warn(`[EncryptedStorage] Failed to decrypt ${key}`);
        return null;
      }
      
      return decrypted;
    } catch (error) {
      console.error(`[EncryptedStorage] Failed to decrypt ${key}:`, error);
      return null;
    }
  },

  /**
   * Remove encrypted item
   * 
   * @param key - Storage key
   */
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(`enc_${key}`);
    } catch (error) {
      console.error(`[EncryptedStorage] Failed to remove ${key}:`, error);
    }
  },

  /**
   * Clear all encrypted items
   */
  clear: (): void => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('enc_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('[EncryptedStorage] Failed to clear:', error);
    }
  },

  /**
   * Check if encrypted item exists
   */
  hasItem: (key: string): boolean => {
    return localStorage.getItem(`enc_${key}`) !== null;
  },
};

/**
 * Session Storage with Auto-Expiry
 * 
 * Stores data in sessionStorage that auto-expires
 * Perfect for temporary tokens and sensitive data
 */
export const secureSessionStorage = {
  /**
   * Store item with optional expiry time
   * 
   * @param key - Storage key
   * @param value - Value to store
   * @param expiryMs - Optional expiry time in milliseconds (default: session lifetime)
   * 
   * @example
   * secureSessionStorage.setItem('temp_token', 'xyz', 3600000); // 1 hour
   */
  setItem: (key: string, value: string, expiryMs?: number): void => {
    try {
      const payload = {
        value,
        timestamp: Date.now(),
        expiry: expiryMs ? Date.now() + expiryMs : null,
      };
      
      sessionStorage.setItem(key, JSON.stringify(payload));
    } catch (error) {
      console.error(`[SecureSessionStorage] Failed to set ${key}:`, error);
    }
  },

  /**
   * Retrieve item if not expired
   * 
   * @param key - Storage key
   * @returns - Value if found and not expired, null otherwise
   */
  getItem: (key: string): string | null => {
    try {
      const data = sessionStorage.getItem(key);
      if (!data) return null;
      
      const payload = JSON.parse(data);
      
      // Check expiry
      if (payload.expiry && payload.expiry < Date.now()) {
        sessionStorage.removeItem(key); // حذف البيانات المنتهية
        return null;
      }
      
      return payload.value;
    } catch (error) {
      console.error(`[SecureSessionStorage] Failed to get ${key}:`, error);
      return null;
    }
  },

  /**
   * Remove item
   */
  removeItem: (key: string): void => {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error(`[SecureSessionStorage] Failed to remove ${key}:`, error);
    }
  },

  /**
   * Clear all session storage
   */
  clear: (): void => {
    try {
      sessionStorage.clear();
    } catch (error) {
      console.error('[SecureSessionStorage] Failed to clear:', error);
    }
  },
};

/**
 * PIN Hashing Utility
 * 
 * Safely hash PINs for storage
 */
export const pinHasher = {
  /**
   * Generate a random salt
   */
  generateSalt: (): string => {
    return CryptoJS.lib.WordArray.random(16).toString();
  },

  /**
   * Hash a PIN with salt
   * 
   * @param pin - PIN to hash (4 digits)
   * @param salt - Salt for hashing
   * @returns - Hashed PIN
   */
  hashPin: (pin: string, salt: string): string => {
    if (!/^\d{4}$/.test(pin)) {
      throw new Error('PIN must be exactly 4 digits');
    }
    
    return CryptoJS.PBKDF2(pin, salt, {
      keySize: 256 / 32,
      iterations: 1000, // عدد التكرارات يزيد الأمان
    }).toString();
  },

  /**
   * Verify a PIN against hash
   * 
   * @param pin - PIN to verify
   * @param hash - Stored hash
   * @param salt - Salt used for hashing
   * @returns - true if PIN matches hash
   */
  verifyPin: (pin: string, hash: string, salt: string): boolean => {
    try {
      const computed = pinHasher.hashPin(pin, salt);
      return computed === hash;
    } catch {
      return false;
    }
  },
};

/**
 * Secure Initialization
 * 
 * Call this on app startup to clean up expired data
 */
export const initializeSecureStorage = (): void => {
  try {
    // تنظيف جلسات منتهية
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      secureSessionStorage.getItem(key); // هذا سيحذف البيانات المنتهية
    });
  } catch (error) {
    console.warn('[SecureStorage] Initialization failed:', error);
  }
};

/**
 * Export all sensitive data securely
 * 
 * @returns - Encrypted backup of all sensitive data
 */
export const backupSensitiveData = (): string => {
  try {
    const backup = {
      timestamp: Date.now(),
      version: 1,
      data: {
        pin: encryptedStorage.getItem('pin_hash'),
        tursoUrl: encryptedStorage.getItem('turso_url'),
        // لا تشمل الـ token في الـ backup
      },
    };
    
    return CryptoJS.AES.encrypt(
      JSON.stringify(backup),
      DEVICE_KEY
    ).toString();
  } catch (error) {
    console.error('[SecureStorage] Backup failed:', error);
    return '';
  }
};

/**
 * Restore sensitive data from backup
 * 
 * @param backup - Encrypted backup string
 */
export const restoreSensitiveData = (backup: string): boolean => {
  try {
    const decrypted = CryptoJS.AES.decrypt(backup, DEVICE_KEY).toString(
      CryptoJS.enc.Utf8
    );
    const data = JSON.parse(decrypted);
    
    // Restore
    if (data.data.pin) {
      encryptedStorage.setItem('pin_hash', data.data.pin);
    }
    if (data.data.tursoUrl) {
      encryptedStorage.setItem('turso_url', data.data.tursoUrl);
    }
    
    return true;
  } catch (error) {
    console.error('[SecureStorage] Restore failed:', error);
    return false;
  }
};
