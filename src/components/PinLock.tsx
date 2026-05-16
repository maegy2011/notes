import React, { useState, useRef, useEffect } from 'react';
import { Lock as LockIcon, Eye, EyeOff, LockKeyhole, AlertTriangle, Delete } from 'lucide-react';

const PIN_STORAGE_KEY = 'notes_app_pin_hash_v1';
const DEVICE_SALT_KEY = '_app_salt';
const APP_LOCK_KEY = 'notes_app_lock_enabled_v1';
const LOCKED_NOTES_KEY = 'notes_app_locked_ids_v1';
const PIN_ATTEMPTS_KEY = 'notes_app_pin_attempts_v1';
const PIN_LOCKOUT_KEY = 'notes_app_pin_lockout_v1';
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60_000; // دقيقة واحدة

interface PinLockProps {
  mode: 'set' | 'unlock' | 'verify' | 'unlock_all' | 'lock_all';
  noteTitle?: string;
  onSuccess: () => void;
  onCancel: () => void;
  showToast?: (msg: string) => void;
}

export const PinLock: React.FC<PinLockProps> = ({
  mode,
  noteTitle,
  onSuccess,
  onCancel,
  showToast
}) => {
  const [pin, setPin] = useState<string[]>(Array(4).fill(''));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [firstPin, setFirstPin] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    // Check if currently in lockout period
    checkLockout();
    return () => {
      if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
    };
  }, []);

  const checkLockout = () => {
    const lockoutUntil = localStorage.getItem(PIN_LOCKOUT_KEY);
    if (lockoutUntil) {
      const remaining = parseInt(lockoutUntil) - Date.now();
      if (remaining > 0) {
        setLockoutRemaining(remaining);
        startLockoutTimer(parseInt(lockoutUntil));
      } else {
        clearLockout();
      }
    }
  };

  const startLockoutTimer = (untilMs: number) => {
    if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
    lockoutTimerRef.current = setInterval(() => {
      const remaining = untilMs - Date.now();
      if (remaining <= 0) {
        setLockoutRemaining(0);
        clearLockout();
        if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
      } else {
        setLockoutRemaining(remaining);
      }
    }, 1000);
  };

  const recordFailedAttempt = () => {
    const attempts = getFailedAttempts() + 1;
    localStorage.setItem(PIN_ATTEMPTS_KEY, attempts.toString());
    if (attempts >= MAX_PIN_ATTEMPTS) {
      const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      localStorage.setItem(PIN_LOCKOUT_KEY, lockoutUntil.toString());
      setLockoutRemaining(LOCKOUT_DURATION_MS);
      startLockoutTimer(lockoutUntil);
      showToast?.(`تم تجاوز الحد المسموح. انتظر دقيقة واحدة`);
    }
  };

  const resetFailedAttempts = () => {
    localStorage.removeItem(PIN_ATTEMPTS_KEY);
    clearLockout();
  };

  const getFailedAttempts = (): number => {
    const val = localStorage.getItem(PIN_ATTEMPTS_KEY);
    return val ? parseInt(val) : 0;
  };

  const clearLockout = () => {
    localStorage.removeItem(PIN_LOCKOUT_KEY);
    localStorage.removeItem(PIN_ATTEMPTS_KEY);
  };

  useEffect(() => {
    if (error) {
      setShakeError(true);
      const timer = setTimeout(() => {
        setError(null);
        setShakeError(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleKeyPress = (digit: string) => {
  if (currentIndex >= 4) return;
  const newPin = [...pin];
  newPin[currentIndex] = digit;
  setPin(newPin);
  setCurrentIndex(currentIndex + 1);
  if (currentIndex === 3) {
    setTimeout(async () => {
      await handleComplete(newPin.join(''));
    }, 250);
  }
};



  // ✅ توليد salt ثابت لهذا الجهاز
  const getDeviceSalt = (): string => {
let salt = localStorage.getItem(DEVICE_SALT_KEY);
if (!salt) {
// ✅ استخدام Web Crypto API الآمن
const randomBytes = crypto.getRandomValues(new Uint8Array(16));
salt = Array.from(randomBytes)
.map(b => b.toString(16).padStart(2, '0'))
.join('');
localStorage.setItem(DEVICE_SALT_KEY, salt);
}
return salt;
};

const hashPin = async (pin: string): Promise<string> => {
const salt = getDeviceSalt();
const encoder = new TextEncoder();
const pinData = encoder.encode(pin);
const saltData = encoder.encode(salt);
// ✅ الجمع بين PIN والملح
const combined = new Uint8Array(pinData.length + saltData.length);
combined.set(pinData, 0);
combined.set(saltData, pinData.length);
// ✅ استخدام Web Crypto API مع SHA-256 و PBKDF2
const key = await crypto.subtle.deriveKey(
{ name: 'PBKDF2', salt: saltData, iterations: 100000, hash: 'SHA-256' },
await crypto.subtle.importKey('raw', pinData, 'PBKDF2', false, ['deriveBits']),
{ name: 'HMAC', hash: 'SHA-256' },
true,
['sign', 'verify']
);
const exported = await crypto.subtle.exportKey('raw', key);
return Array.from(new Uint8Array(exported))
.map(b => b.toString(16).padStart(2, '0'))
.join('');
};


  // ✅ التحقق من PIN
  const verifyPin = async (enteredPin: string, storedHash: string): Promise<boolean> => {
  const computedHash = await hashPin(enteredPin);
// ✅ مقارنة آمنة — كلا الطول والمحتوى يجب أن يتطابقا
const computedLen = computedHash.length;
const storedLen = storedHash.length;
// تجنب إرجاع false في الحال إذا كان الطول مختلفاً — استمر في المقارنة
const maxLen = Math.max(computedLen, storedLen);
if (maxLen === 0) return false; // كلاهما فارغ
let result = 0;
for (let i = 0; i < maxLen; i++) {
  const c1 = i < computedLen ? computedHash.charCodeAt(i) : 0;
  const c2 = i < storedLen ? storedHash.charCodeAt(i) : 0;
  result |= c1 ^ c2;
}
return result === 0;


  const getStoredPinHash = (): string | null => {
    return localStorage.getItem(PIN_STORAGE_KEY);
  };

  const savePinHash = async (newPin: string) => {
  const hash = await hashPin(newPin);
  localStorage.setItem(PIN_STORAGE_KEY, hash);
};


  const handleDelete = () => {
    if (currentIndex === 0) return;
    const newPin = [...pin];
    newPin[currentIndex - 1] = '';
    setPin(newPin);
    setCurrentIndex(currentIndex - 1);
    setError(null);
  };

  const handleComplete = async (enteredPin: string) => {
  if (mode === 'set') {
    if (!isConfirming) {
      const hash = await hashPin(enteredPin);
      setFirstPin(hash);
      setIsConfirming(true);
      setPin(Array(4).fill(''));
      setCurrentIndex(0);
      showToast?.('أعد إدخال الرقم السري للتأكيد');
      return;
    } else {
      const isMatch = await verifyPin(enteredPin, firstPin);
      if (isMatch) {
        await savePinHash(enteredPin);
        showToast?.('✅ تم تعيين الرقم السري بنجاح');
        onSuccess();
      } else {
        setError('الرقم السري غير متطابق! حاول مرة أخرى');
        setPin(Array(4).fill(''));
        setCurrentIndex(0);
        setFirstPin('');
        setIsConfirming(false);
      }
      return;
    }
  }
  // unlock, verify, unlock_all, lock_all
  if (lockoutRemaining > 0) {
    setError(`محاولات كثيرة. انتظر ${Math.ceil(lockoutRemaining / 1000)} ثانية`);
    setPin(Array(4).fill(''));
    setCurrentIndex(0);
    return;
  }
  const storedHash = getStoredPinHash();
  if (storedHash && (await verifyPin(enteredPin, storedHash))) {
    resetFailedAttempts();
    onSuccess();
  } else {
    recordFailedAttempt();
    const attemptsLeft = MAX_PIN_ATTEMPTS - getFailedAttempts();
    setError(attemptsLeft > 0 ? `الرقم السري غير صحيح! (متبقي ${attemptsLeft} محاولات)` : 'تم تجاوز الحد المسموح. انتظر...');
    setPin(Array(4).fill(''));
    setCurrentIndex(0);
    showToast?.('❌ الرقم السري غير صحيح');
  }
};


  const getTitle = () => {
    switch (mode) {
      case 'set':
        return isConfirming ? 'تأكيد الرقم السري' : 'تعيين رقم سري جديد';
      case 'unlock':
        return `فتح: ${noteTitle || 'الملاحظة'}`;
      case 'verify':
        return 'التحقق من هويتك';
      case 'unlock_all':
        return 'فتح جميع الملاحظات';
      case 'lock_all':
        return 'قفل جميع الملاحظات';
      default:
        return 'أدخل الرقم السري';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'set':
        return isConfirming ? 'أعد إدخال الرقم السري المكون من 4 أرقام' : 'اختر رقماً سرياً مكوناً من 4 أرقام لحماية ملاحظاتك';
      case 'unlock':
        return 'أدخل الرقم السري لفتح هذه الملاحظة';
      case 'verify':
        return 'أدخل الرقم السري للمتابعة';
      case 'unlock_all':
        return 'أدخل الرقم السري لفتح جميع الملاحظات المقفلة';
      case 'lock_all':
        return 'أدخل الرقم السري لقفل جميع الملاحظات';
      default:
        return 'أدخل الرقم السري المكون من 4 أرقام';
    }
  };

  const getIconBg = () => {
    if (mode === 'set') return 'bg-amber-500/20 text-amber-400';
    if (mode === 'lock_all' || mode === 'unlock_all') return 'bg-purple-500/20 text-purple-400';
    return 'bg-sky-500/20 text-sky-400';
  };

  return (
    <div className="fixed inset-0 bg-slate-950/98 z-50 flex flex-col items-center justify-center p-6 animate-fadeIn select-none" dir="rtl">
      <div className={`w-full max-w-xs mx-auto bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl ${shakeError ? 'animate-pulse' : ''}`}>
        
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${getIconBg()}`}>
            {mode === 'set' ? <LockKeyhole size={32} /> : <LockIcon size={32} />}
          </div>
        </div>

        {/* Title */}
        <h2 className="text-sm font-bold text-white text-center mb-1">
          {getTitle()}
        </h2>
        <p className="text-xs text-slate-400 text-center mb-5">
          {getSubtitle()}
        </p>

        {/* PIN Dots Display */}
        <div className="flex justify-center gap-3 mb-2" dir="ltr">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full transition-all duration-200 border-2 ${
                pin[idx]
                  ? showPin
                    ? 'bg-amber-400 border-amber-400 scale-110'
                    : 'bg-amber-400 border-amber-400'
                  : currentIndex === idx
                  ? 'border-amber-500 bg-amber-500/20 scale-125'
                  : 'border-slate-600 bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Show entered PIN as text if visible */}
        {showPin && (
          <p className="text-center text-sm text-amber-400 font-mono tracking-[0.5em] mb-2" dir="ltr">
            {pin.map(d => d || '·').join('')}
          </p>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center justify-center gap-1 text-rose-400 text-xs mb-2 animate-fadeIn">
            <AlertTriangle size={12} />
            <span>{error}</span>
          </div>
        )}

        {/* Toggle PIN visibility */}
        <div className="flex justify-center mb-4">
          <button
            onClick={() => setShowPin(!showPin)}
            className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
          >
            {showPin ? <EyeOff size={12} /> : <Eye size={12} />}
            {showPin ? 'إخفاء' : 'إظهار'}
          </button>
        </div>

        {/* Visual Numpad - LTR for proper number ordering */}
        <div className="grid grid-cols-3 gap-2 mb-3 max-w-[240px] mx-auto" dir="ltr">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleKeyPress(num.toString())}
              className="h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white text-xl font-bold transition-all active:scale-90 border border-slate-700/50"
            >
              {num}
            </button>
          ))}
          {/* Empty space */}
          <div />
          {/* 0 */}
          <button
            onClick={() => handleKeyPress('0')}
            className="h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white text-xl font-bold transition-all active:scale-90 border border-slate-700/50"
          >
            0
          </button>
          {/* Delete */}
          <button
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-slate-800 hover:bg-rose-500/20 active:bg-rose-500/30 text-slate-400 hover:text-rose-400 text-sm transition-all active:scale-90 border border-slate-700/50 flex items-center justify-center"
          >
            <Delete size={20} />
          </button>
        </div>

        {/* Cancel button */}
        <button
          onClick={onCancel}
          className="w-full py-2.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-800"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
};

// Helper functions for managing lock state
export const lockHelpers = {
  isAppLockEnabled: (): boolean => {
    return localStorage.getItem(APP_LOCK_KEY) === 'true' && !!localStorage.getItem(PIN_STORAGE_KEY);
  },

  setAppLock: (enabled: boolean) => {
    localStorage.setItem(APP_LOCK_KEY, enabled ? 'true' : 'false');
  },

  hasPin: (): boolean => {
    return !!localStorage.getItem(PIN_STORAGE_KEY);
  },

  clearPin: () => {
    localStorage.removeItem(PIN_STORAGE_KEY);
    localStorage.removeItem(APP_LOCK_KEY);
    localStorage.removeItem(LOCKED_NOTES_KEY);
  },

  toggleNoteLock: (noteId: string, lock: boolean) => {
    try {
      const data = localStorage.getItem(LOCKED_NOTES_KEY);
      let ids: string[] = data ? JSON.parse(data) : [];
      if (lock) {
        if (!ids.includes(noteId)) ids.push(noteId);
      } else {
        ids = ids.filter(id => id !== noteId);
      }
      localStorage.setItem(LOCKED_NOTES_KEY, JSON.stringify(ids));
    } catch {}
  },

  lockAllNotes: (noteIds: string[]) => {
    try {
      localStorage.setItem(LOCKED_NOTES_KEY, JSON.stringify(noteIds));
    } catch {}
  },

  unlockAllNotes: () => {
    localStorage.setItem(LOCKED_NOTES_KEY, JSON.stringify([]));
  },

  isNoteLocked: (noteId: string): boolean => {
    try {
      const data = localStorage.getItem(LOCKED_NOTES_KEY);
      return data ? JSON.parse(data).includes(noteId) : false;
    } catch {
      return false;
    }
  },

  getLockedNoteIds: (): string[] => {
    try {
      return JSON.parse(localStorage.getItem(LOCKED_NOTES_KEY) || '[]');
    } catch {
      return [];
    }
  },

  clearLockedNotes: () => {
    localStorage.removeItem(LOCKED_NOTES_KEY);
  }
};
