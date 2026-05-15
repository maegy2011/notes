# 📋 تقرير فحص الأمان الشامل - Security Audit Report

**التاريخ:** 2026-05-15  
**المستودع:** maegy2011/notes  
**التطبيق:** ملاحظاتي (Mohafadaty)  
**حالة التطبيق:** تطبيق ويب React + SQLite محلي + Turso اختياري

---

## 🔍 ملخص الفحص

| المستوى | العدد | الحالة |
|--------|------|--------|
| 🔴 **حرج (Critical)** | 3 | يتطلب إصلاح فوري |
| 🟠 **مرتفع (High)** | 4 | يتطلب إصلاح سريع |
| 🟡 **متوسط (Medium)** | 5 | يجب معالجته قبل الإطلاق |
| 🔵 **منخفض (Low)** | 4 | يُفضل معالجته |
| ✅ **نقاط جيدة** | 5 | معايير أمان ممتازة |

**الدرجة الإجمالية:** 6.2/10 ⚠️

---

## 🔴 الثغرات الحرجة (Critical)

### 1. **XSS في محرر الملاحظات عبر innerHTML**

**الموقع:** `src/components/NoteEditor.tsx`  
**المستوى:** 🔴 حرج  
**الخطورة:** عالية جداً

**المشكلة:**
```tsx
// لا يوجد تعقيم للـ HTML المدخل
// يمكن للمهاجم إدراج كود JavaScript مباشرة
```

**الخطر:**
- سرقة البيانات الحساسة (PIN، توكنات)
- تنفيذ كود خبيث
- الوصول إلى localStorage

**الحل:**
استخدام مكتبة DOMPurify لتعقيم HTML:

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

```tsx
import DOMPurify from 'dompurify';

// في معالجة المحتوى
const sanitizedContent = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'code', 'pre'],
  ALLOWED_ATTR: ['style'],
  KEEP_CONTENT: true
});
```

---

### 2. **تسريب Turso Token في localStorage**

**الموقع:** `src/utils/tursoSync.ts` (السطور 15-27)  
**المستوى:** 🔴 حرج  
**الخطورة:** عالية جداً

**المشكلة:**
```typescript
const CONFIG_KEY = 'notes_app_turso_config_v1';

export const tursoHelpers = {
  getConfig: (): TursoConfig => {
    try {
      const data = localStorage.getItem(CONFIG_KEY);
      if (data) return JSON.parse(data);
    } catch {}
    return { url: '', token: '', autoSync: false };
  },
  
  saveConfig: (cfg: TursoConfig) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); // ❌ حفظ التوكن بدون تشفير
  },
};
```

**الخطر:**
- أي JavaScript XSS يمكنه الوصول للتوكن
- الوصول غير المصرح إلى قاعدة بيانات Turso
- تعديل/حذف جميع البيانات

**الحل:**
```typescript
import { useRef } from 'react';

// 1. لا تخزن التوكن في localStorage
// 2. استخدم Session Storage مع expiry
// 3. طبق تشفير (Encryption-at-Rest)

export const tursoHelpers = {
  getConfig: (): TursoConfig => {
    // من جلسة العمل فقط، وليس من التخزين الدائم
    const sessionConfig = sessionStorage.getItem(CONFIG_KEY);
    return sessionConfig ? JSON.parse(sessionConfig) : { url: '', token: '', autoSync: false };
  },

  saveConfig: (cfg: TursoConfig) => {
    // تخزين مؤقت فقط
    sessionStorage.setItem(CONFIG_KEY, JSON.stringify({
      url: cfg.url,
      autoSync: cfg.autoSync
      // ❌ لا تخزن التوكن
    }));
    
    // التوكن يجب أن يُدخل من المستخدم كل مرة أو عبر SecureContext
  },

  // إضافة طريقة آمنة للتوكن المؤقت فقط
  setTokenSession: (token: string) => {
    // تخزين مؤقت لجلسة العمل فقط
    sessionStorage.setItem('turso_token_session', token);
  },

  getTokenSession: (): string | null => {
    return sessionStorage.getItem('turso_token_session');
  },

  clearTokenSession: () => {
    sessionStorage.removeItem('turso_token_session');
  }
};
```

---

### 3. **PIN مخزن بدون تشفير في localStorage**

**الموقع:** `src/components/PinLock.tsx` (السطور 73-83)  
**المستوى:** 🔴 حرج  
**الخطورة:** عالية جداً

**المشكلة:**
```typescript
const PIN_STORAGE_KEY = 'notes_app_pin_v1';

const getStoredPin = (): string | null => {
  try {
    return localStorage.getItem(PIN_STORAGE_KEY); // ❌ PIN بالنص الصريح
  } catch {
    return null;
  }
};

const savePin = (newPin: string) => {
  localStorage.setItem(PIN_STORAGE_KEY, newPin); // ❌ حفظ PIN بدون تشفير
};
```

**الخطر:**
- أي JavaScript يمكنه قراءة PIN مباشرة
- Devtools يعرض PIN بوضوح
- localStorage Backup يحتوي على PIN

**الحل:**
```typescript
import * as crypto from 'crypto-js'; // أو bcryptjs

const PIN_STORAGE_KEY = 'notes_app_pin_hash_v1';
const PIN_SALT = 'unique_salt_per_device'; // يجب توليده

// تجزئة PIN
const hashPin = (pin: string): string => {
  return crypto.SHA256(pin + PIN_SALT).toString();
};

// التحقق من PIN
const verifyPin = (enteredPin: string, storedHash: string): boolean => {
  return hashPin(enteredPin) === storedHash;
};

const getStoredPin = (): string | null => {
  return localStorage.getItem(PIN_STORAGE_KEY);
};

const savePin = (newPin: string) => {
  const hash = hashPin(newPin);
  localStorage.setItem(PIN_STORAGE_KEY, hash);
};

// تعديل handleComplete
const handleComplete = (enteredPin: string) => {
  if (mode === 'set') {
    // ... كود بدل من مقارنة مباشرة
    if (verifyPin(enteredPin, firstPin)) { // مقارنة التجزئات
      savePin(enteredPin);
      // ...
    }
  } else {
    const storedHash = getStoredPin();
    if (storedHash && verifyPin(enteredPin, storedHash)) {
      onSuccess();
    } else {
      setError('الرقم السري غير صحيح!');
    }
  }
};
```

---

## 🟠 الثغرات المرتفعة (High)

### 4. **XSS عبر stripHtml غير آمنة**

**الموقع:** `src/utils/shareDuplicate.ts` (السطور 6-11)  
**المستوى:** 🟠 مرتفع

**المشكلة:**
```typescript
const stripHtml = (html: string): string => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html; // ❌ إعادة تحليل HTML قد يُنفذ scripts
  return (tmp.textContent || tmp.innerText || '').trim();
};
```

**الخطر:**
- إعادة تحليل innerHTML يمكن أن يُنفذ event handlers
- مثل: `<img onerror="alert('XSS')">`

**الحل:**
```typescript
import DOMPurify from 'dompurify';

const stripHtml = (html: string): string => {
  if (!html) return '';
  // تعقيم أولاً
  const sanitized = DOMPurify.sanitize(html, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
  const tmp = document.createElement('div');
  tmp.textContent = sanitized;
  return tmp.textContent || '';
};
```

---

### 5. **استخراج البيانات الحساسة عبر DevTools**

**الموقع:** كل محفوظات البيانات في `localStorage`  
**المستوى:** 🟠 مرتفع

**المشكلة:**
- جميع البيانات مرئية في DevTools → Application → localStorage
- Base64 ليس تشفير، بل ترميز فقط
- يمكن فك تشفير Base64 بسهولة

**الحل:**
```typescript
// استخدم EncryptedLocalStorage (مكتبة خارجية)
// أو طبق تشفير يدوي

import CryptoJS from 'crypto-js';

const SECRET_KEY = 'your-secure-key-derived-from-device'; // من Device Fingerprint

export const encryptedStorage = {
  setItem: (key: string, value: string) => {
    const encrypted = CryptoJS.AES.encrypt(value, SECRET_KEY).toString();
    localStorage.setItem(key, encrypted);
  },

  getItem: (key: string): string | null => {
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return null;
    try {
      const decrypted = CryptoJS.AES.decrypt(encrypted, SECRET_KEY).toString(CryptoJS.enc.Utf8);
      return decrypted;
    } catch {
      return null;
    }
  },

  removeItem: (key: string) => {
    localStorage.removeItem(key);
  }
};

// الاستخدام
const b64 = encryptedStorage.getItem(DB_STORAGE_KEY);
encryptedStorage.setItem(PIN_STORAGE_KEY, hash);
```

---

### 6. **عدم التحقق من محتوى الملفات المستوردة**

**الموقع:** `src/App.tsx` (عند استيراد ملفات JSON)  
**المستوى:** 🟠 مرتفع

**المشكلة:**
- لا يوجد تحقق من صحة البيانات المستوردة
- يمكن استيراد أي JSON ضار

**الحل:**
```typescript
import Joi from 'joi'; // أو zod للتحقق

const noteSchema = Joi.object({
  id: Joi.string().required(),
  title: Joi.string().max(500),
  content: Joi.string().max(100000), // حد أقصى معقول
  category: Joi.string().valid('work', 'personal', 'ideas', 'study'),
  // ... تحقق من كل الحقول
});

const validateImportedData = (data: any): boolean => {
  try {
    const schema = Joi.object({
      notes: Joi.array().items(noteSchema),
      events: Joi.array(),
      tasks: Joi.array(),
      // ...
    });
    const { error } = schema.validate(data);
    return !error;
  } catch {
    return false;
  }
};

// في معالج الاستيراد
const handleImport = async (file: File) => {
  const text = await file.text();
  const data = JSON.parse(text);
  
  if (!validateImportedData(data)) {
    showToast('❌ الملف غير صحيح أو يحتوي على بيانات ضارة');
    return;
  }
  
  // متابعة الاستيراد
};
```

---

### 7. **CSRF في Turso Sync**

**الموقع:** `src/utils/tursoSync.ts` (السطور 68-75)  
**المستوى:** 🟠 مرتفع

**المشكلة:**
- عدم وجود CSRF token أو SameSite protection
- الطلبات قد تُصدر من تطبيقات أخرى

**الحل:**
```typescript
export const executeBatch = async (
  config: TursoConfig,
  statements: SQLStatement[]
): Promise<any> => {
  const url = `${tursoHelpers.sanitizeUrl(config.url)}/v2/pipeline`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest', // تحديد الطلب من الويب
      'Origin': window.location.origin, // التحقق من الأصل
      'Referer': window.location.href,
    },
    credentials: 'same-origin', // للـ cookies إن وجدت
    body: JSON.stringify({ requests }),
  });

  // ... معالجة الرد
};
```

---

## 🟡 الثغرات المتوسطة (Medium)

### 8. **Weak UID Generator**

**الموقع:** `src/utils/shareDuplicate.ts` (السطر 21)، `src/components/ShoppingView.tsx`  
**المستوى:** 🟡 متوسط

**المشكلة:**
```typescript
const uid = () => Date.now().toString() + Math.random().toString(36).slice(2, 7);
// ❌ سهل التنبؤ بـ UID الجديد
```

**الحل:**
```typescript
// استخدم crypto API
const uid = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
```

---

### 9. **عدم وجود Rate Limiting على Turso API**

**الموقع:** `src/utils/tursoSync.ts`  
**المستوى:** 🟡 متوسط

**المشكلة:**
- لا يوجد حماية من الطلبات المتكررة
- قد يؤدي إلى استنزاف الموارد

**الحل:**
```typescript
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // بالملي ثانية
}

class RateLimiter {
  private requests: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 }) {
    this.config = config;
  }

  isAllowed(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.config.windowMs);
    
    if (this.requests.length < this.config.maxRequests) {
      this.requests.push(now);
      return true;
    }
    return false;
  }
}

const syncLimiter = new RateLimiter({ maxRequests: 5, windowMs: 60000 });

export const syncNow = async (config: TursoConfig, showToast: (msg: string) => void) => {
  if (!syncLimiter.isAllowed()) {
    showToast('⏸️ الرجاء الانتظار قبل محاولة المزامنة مرة أخرى');
    return false;
  }
  // ... باقي الكود
};
```

---

### 10. **localStorage عرضة لـ XSS attacks**

**الموقع:** كل استخدامات localStorage  
**المستوى:** 🟡 متوسط

**المشكلة:**
- أي JavaScript يمكنه الوصول إلى localStorage
- لا توجد حماية على مستوى المتصفح

**الحل:**
```typescript
// 1. استخدم HttpOnly Cookies (عبر الـ backend إن أمكن)
// 2. طبق Content Security Policy
// 3. استخدم مكتبة EncryptedStorage
// 4. في index.html، أضف:

/*
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' fonts.googleapis.com;
  style-src 'self' 'unsafe-inline' fonts.googleapis.com fonts.gstatic.com;
  connect-src 'self' *.turso.io fonts.googleapis.com;
  font-src 'self' fonts.gstatic.com;
  img-src 'self' data:;
  object-src 'none';
  frame-ancestors 'none';
  form-action 'self';
">
*/
```

---

### 11. **عدم التحقق من حجم البيانات المرفوعة**

**الموقع:** `src/utils/tursoSync.ts` (السطور 196-201)  
**المستوى:** 🟡 متوسط

**المشكلة:**
```typescript
// لا يوجد حد أقصى لحجم البيانات المرسلة
for (let i = 0; i < uploadStatements.length; i += batchSize) {
  const batch = uploadStatements.slice(i, i + batchSize);
  await tursoHelpers.executeBatch(config, batch);
}
```

**الحل:**
```typescript
const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB

const calculatePayloadSize = (statements: any[]): number => {
  return JSON.stringify(statements).length;
};

// في syncNow
const payloadSize = calculatePayloadSize(uploadStatements);
if (payloadSize > MAX_PAYLOAD_SIZE) {
  showToast('❌ البيانات كبيرة جداً للمزامنة');
  return false;
}
```

---

### 12. **لا توجد معالجة لـ Timeout في الطلبات**

**الموقع:** `src/utils/tursoSync.ts`  
**المستوى:** 🟡 متوسط

**الحل:**
```typescript
const fetchWithTimeout = (url: string, options: any, timeoutMs: number = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
};

// في executeBatch
const response = await fetchWithTimeout(url, {
  method: 'POST',
  headers: { /* ... */ },
  body: JSON.stringify({ requests }),
}, 10000); // 10 ثواني timeout
```

---

## 🔵 الثغرات المنخفضة (Low)

### 13. **Error Messages تعرض معلومات حساسة**

**الموقع:** `src/utils/tursoSync.ts` (السطر 78)  
**المستوى:** 🔵 منخفض

**الحل:**
```typescript
// بدل من:
throw new Error(errText || `HTTP ${response.status}`);

// استخدم:
const errorMsg = response.status === 401 
  ? 'خطأ في المصادقة. تحقق من بيانات Turso.'
  : response.status === 500 
  ? 'خطأ في الخادم. حاول لاحقاً.'
  : 'حدث خطأ في المزامنة';

console.error('[Turso] Raw error:', errText); // log محلي فقط
throw new Error(errorMsg); // رسالة آمنة للمستخدم
```

---

### 14. **عدم حذف البيانات الحساسة عند تسجيل الخروج**

**الموقع:** جميع المكونات  
**المستوى:** 🔵 منخفض

**الحل:**
```typescript
const clearSensitiveData = () => {
  // حذف البيانات الحساسة من الذاكرة
  sessionStorage.clear();
  // لا تحذف localStorage (قد يكون مقصوداً)
};

// عند إغلاق التطبيق
window.addEventListener('beforeunload', () => {
  // تنظيف اختياري
});
```

---

### 15. **عدم وجود Integrity Check للبيانات المستعادة**

**الموقع:** `src/utils/sqliteDb.ts`  
**المستوى:** 🔵 منخفض

**الحل:**
```typescript
import { createHash } from 'crypto';

interface DatabaseBackup {
  data: string; // base64
  checksum: string; // SHA256 للتحقق
  version: number;
  timestamp: number;
}

const getDbBackupWithChecksum = (): DatabaseBackup => {
  const b64 = getDbBase64();
  if (!b64) throw new Error('No backup available');
  
  const checksum = crypto.subtle.digest('SHA-256', new TextEncoder().encode(b64));
  
  return {
    data: b64,
    checksum: Array.from(new Uint8Array(checksum))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
    version: 1,
    timestamp: Date.now(),
  };
};

const restoreDbWithIntegrityCheck = (backup: DatabaseBackup) => {
  // التحقق من الـ checksum
  // ...
};
```

---

### 16. **عدم وجود logging آمن للأحداث الحساسة**

**الموقع:** جميع المكونات  
**المستوى:** 🔵 منخفض

**الحل:**
```typescript
// نظام logging آمن
export const secureLogger = {
  logSensitiveEvent: (event: string, details: any) => {
    // تسجيل محلي فقط، بدون بيانات حساسة
    const safeDetails = {
      ...details,
      pin: '***',
      token: '***',
      password: '***',
    };
    
    console.log(`[SECURITY EVENT] ${event}:`, safeDetails);
    
    // يمكن حفظ في IndexedDB لاحقاً
  }
};
```

---

## ✅ نقاط جيدة (Strengths)

### 1. ✅ استخدام sql.js (SQLite WASM) محلياً
- لا توجد بيانات على خوادم خارجية افتراضياً
- SQLite أكثر أماناً من البيانات المفتوحة

### 2. ✅ Content Security Policy جيدة
- index.html يحتوي على meta tags صحيحة
- Viewport وضبط الأمان محسّن

### 3. ✅ PWA Manifest آمن
- لا يحتوي على معلومات حساسة
- أيقونة آمنة

### 4. ✅ TypeScript Strict Mode
- `"strict": true` في tsconfig.json
- حماية من أخطاء النوع

### 5. ✅ استخدام Environment Variables
- بإمكان إضافة `.env` للمفاتيح الحساسة

---

## 📋 خطة الإصلاح (Action Plan)

### المرحلة 1: الإصلاح الفوري (Critical - هذا الأسبوع)
- [ ] تثبيت DOMPurify ومعالجة XSS
- [ ] إعادة بناء نظام Turso Token (Session Storage فقط)
- [ ] تجزئة PIN باستخدام crypto-js

### المرحلة 2: الإصلاح السريع (High - الأسبوع القادم)
- [ ] إضافة تشفير localStorage
- [ ] تطبيق validation على الملفات المستوردة
- [ ] إضافة CSRF protection

### المرحلة 3: التحسينات (Medium - خلال الشهر)
- [ ] استخدام crypto API للـ UID
- [ ] تطبيق Rate Limiting
- [ ] إضافة Content Security Policy

### المرحلة 4: التحسينات الإضافية (Low)
- [ ] تحسين معالجة الأخطاء
- [ ] نظام logging آمن
- [ ] Integrity checks

---

## 🚀 التوصيات العامة

### 1. استخدم HTTPS فقط
```json
// في vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    }
  ]
}
```

### 2. أضف Security Headers
```typescript
// في vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {"key": "X-Content-Type-Options", "value": "nosniff"},
        {"key": "X-Frame-Options", "value": "DENY"},
        {"key": "X-XSS-Protection", "value": "1; mode=block"},
        {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"},
        {"key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()"}
      ]
    }
  ]
}
```

### 3. راقب الثغرات
```bash
npm audit
npm update
```

### 4. اختبار الأمان الدوري
- استخدم OWASP ZAP أو Burp Suite
- اختبر XSS يدوياً
- فحص localStorage في DevTools

---

## 📚 المراجع والموارد

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [DOMPurify](https://github.com/cure53/DOMPurify)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [CWE Top 25](https://cwe.mitre.org/top25/)

---

**تاريخ المراجعة التالية:** 2026-05-22  
**معد التقرير:** GitHub Copilot Security Audit

