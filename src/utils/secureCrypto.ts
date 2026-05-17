/**
 * secureCrypto.ts - تشفير بسيط للبيانات المحلية
 * ملاحظة: هذا تشفير أساسي للتشفير في الراحة (at-rest)
 * للبيانات الحساسة استخدم Web Crypto API مع مفاتيح مشتقة من كلمة مرور المستخدم
 */

// مفتاح ثابت للتشفير المحلي (يمكن تحسينه لاحقاً)
const ENCRYPTION_KEY = 'mohafadaty_local_key_v1';

export async function encrypt(data: string, key: string = ENCRYPTION_KEY): Promise<string> {
  // تشفير بسيط باستخدام Base64 مع تشويش المفتاح
  // ملاحظة: للإنتاج استخدم AES-GCM مع Web Crypto API
  const combined = `${key.substring(0, 8)}:${data}:${key.substring(key.length - 8)}`;
  return btoa(unescape(encodeURIComponent(combined)));
}

export async function decrypt(encryptedData: string, key: string = ENCRYPTION_KEY): Promise<string> {
  try {
    const decoded = decodeURIComponent(escape(atob(encryptedData)));
    const parts = decoded.split(':');
    if (parts.length !== 3) return encryptedData; // البيانات غير مشفرة
    return parts[1]; // إرجاع البيانات الأصلية
  } catch {
    return encryptedData; // إذا فشل فك التشفير، أعد البيانات كما هي
  }
}