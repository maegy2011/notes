import { dbNotes, dbEvents, dbTasks, dbShopping } from './sqliteDb';
import { Note, AppEvent, AppTask, ShoppingList } from '../types';

export interface TursoConfig {
  url: string;
  token: string;
  autoSync: boolean;
}

interface SQLStatement {
  sql: string;
  args?: any[];
}

const CONFIG_KEY = 'notes_app_turso_config_v1';
const TOKEN_SESSION_KEY = 'turso_token_tmp';

// ✅ Rate Limiter لمنع الإساءة
class RateLimiter {
  private timestamps: number[] = [];
  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}
  
  isAllowed(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(now);
      return true;
    }
    return false;
  }
}

const syncLimiter = new RateLimiter(5, 60_000); // ✅ 5 طلبات كل دقيقة

// ✅ Fetch مع Timeout
const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs = 10000
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export const tursoHelpers = {
    getConfig: (): TursoConfig => {
    try {
      const data = localStorage.getItem(CONFIG_KEY);
      const cfg = data ? JSON.parse(data) : { url: '', autoSync: false };
      // التحقق من انتهاء صلاحية التوكن
      let token = '';
      const tokenRaw = sessionStorage.getItem(TOKEN_SESSION_KEY);
      if (tokenRaw) {
        try {
          const tokenData = JSON.parse(tokenRaw);
          if (tokenData.expiresAt && Date.now() < tokenData.expiresAt) {
            token = tokenData.value;
          } else {
            sessionStorage.removeItem(TOKEN_SESSION_KEY);
          }
        } catch {
          sessionStorage.removeItem(TOKEN_SESSION_KEY);
        }
      }
      return { ...cfg, token };
    } catch {}
    return { url: '', token: '', autoSync: false };
  },

    saveConfig: (cfg: TursoConfig) => {
    const { token, ...safeConfig } = cfg;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(safeConfig));
    if (token) {
      // تخزين التوكن مع طابع زمني لانتهاء الصلاحية (8 ساعات)
      const tokenData = JSON.stringify({
        value: token,
        expiresAt: Date.now() + 8 * 60 * 60 * 1000
      });
      sessionStorage.setItem(TOKEN_SESSION_KEY, tokenData);
    }
  },

  clearToken: () => {
    sessionStorage.removeItem(TOKEN_SESSION_KEY);
  },

  sanitizeUrl: (url: string): string => {
    let sanitized = url.trim();
    if (sanitized.startsWith('libsql://')) {
      sanitized = sanitized.replace('libsql://', 'https://');
    }
    if (sanitized.startsWith('http://')) {
      sanitized = sanitized.replace('http://', 'https://');
    }
    if (!sanitized.startsWith('https://')) {
      sanitized = 'https://' + sanitized;
    }
    if (sanitized.endsWith('/')) sanitized = sanitized.slice(0, -1);
    // ✅ التحقق من أن الرابط ينتمي لنطاق Turso فقط
    try {
      const hostname = new URL(sanitized).hostname;
      if (!hostname.endsWith('.turso.io') && hostname !== 'turso.io') {
        throw new Error('رابط غير صالح: يجب أن ينتمي لنطاق turso.io');
      }
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'رابط قاعدة بيانات غير صالح');
    }
    return sanitized;
  },

  /** Execute a batch of raw SQL statements against Turso HTTP Pipeline */
  executeBatch: async (
    config: TursoConfig,
    statements: SQLStatement[]
  ): Promise<any> => {
    const url = `${tursoHelpers.sanitizeUrl(config.url)}/v2/pipeline`;
    
    const requests = statements.map(stmt => {
      const args = stmt.args ? stmt.args.map(arg => {
        if (typeof arg === 'string') return { type: 'text', value: arg };
        if (typeof arg === 'number') return { type: 'integer', value: arg };
        if (typeof arg === 'boolean') return { type: 'integer', value: arg ? 1 : 0 };
        if (arg === null) return { type: 'null' };
        return { type: 'text', value: JSON.stringify(arg) };
      }) : [];

      return {
        type: 'execute',
        stmt: {
          sql: stmt.sql,
          args: args.length > 0 ? args : undefined
        }
      };
    });

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    }, 10000); // ✅ 10 ثواني كحد أقصى

    if (!response.ok) {
try {
const errorBody = await response.text();
// ✅ عدم تسجيل محتوى الخطأ الكامل — قد يحتوي معلومات حساسة
if (import.meta.env.DEV && errorBody && errorBody.length < 500) {
console.error('[Turso] Error response (first 500 chars):', errorBody.substring(0, 500));
}
} catch {
// تجاهل الخطأ في قراءة الاستجابة
}
if (import.meta.env.DEV) console.error('[Turso] Request failed with status:', response.status);
// ✅ رسالة عامة وآمنة — لا تكشف تفاصيل التطبيق
const userMessage =
response.status === 401 ? 'خطأ في المصادقة — تحقق من بيانات الاتصال' :
response.status === 403 ? 'ليس لديك صلاحية الوصول إلى قاعدة البيانات' :
response.status === 429 ? 'عدد محاولات كثير — انتظر بضع دقائق' :
response.status >= 500 ? 'الخادم غير متاح حالياً' :
'فشل الاتصال بقاعدة البيانات';
throw new Error(userMessage);
}


    const result = await response.json();
    
    if (result.results) {
      for (const res of result.results) {
        if (res.type === 'error') {
          throw new Error(res.error?.message || 'SQL execution error in batch');
        }
      }
    }
    
    return result;
  },

  /** Test connection by executing a simple SELECT query */
  testConnection: async (config: TursoConfig): Promise<boolean> => {
    if (!config.url || !config.token) return false;
    try {
      await tursoHelpers.executeBatch(config, [{ sql: 'SELECT 1' }]);
      return true;
    } catch (err) {
      console.error('[Turso] Test connection failed:', err);
      throw err;
    }
  },

  /** Bootstrap database tables on Turso */
  bootstrapTables: async (config: TursoConfig) => {
    await tursoHelpers.executeBatch(config, [
      { sql: `CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, data TEXT)` },
      { sql: `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, data TEXT)` },
      { sql: `CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, data TEXT)` },
      { sql: `CREATE TABLE IF NOT EXISTS shopping_lists (id TEXT PRIMARY KEY, data TEXT)` },
    ]);
  },

  /** Synchronize local SQLite tables with Turso Edge DB */
  syncNow: async (config: TursoConfig, showToast: (msg: string) => void): Promise<boolean> => {
    if (!config.url || !config.token) return false;

    // ✅ Rate Limiting
    if (!syncLimiter.isAllowed()) {
      showToast('⏸️ الرجاء الانتظار قبل المزامنة مرة أخرى');
      return false;
    }

    try {
      showToast('🔄 جاري الاتصال بقاعدة بيانات Turso...');
      
      // 1. Ensure Turso tables exist
      await tursoHelpers.bootstrapTables(config);

      // 2. Load local data
      const localNotes = dbNotes.getAll();
      const localEvents = dbEvents.getAll();
      const localTasks = dbTasks.getAll();
      const localShopping = dbShopping.getAll();

      showToast('📥 جاري تنزيل وتحديث البيانات السحابية...');

      // 3. Download remote records for all tables
      const downloadResult = await tursoHelpers.executeBatch(config, [
        { sql: 'SELECT id, data FROM notes' },
        { sql: 'SELECT id, data FROM events' },
        { sql: 'SELECT id, data FROM tasks' },
        { sql: 'SELECT id, data FROM shopping_lists' }
      ]);

      // ✅ مع تحقق إضافي من السلامة
      const remoteNotes = mapRemoteRows<Note>(downloadResult.results[0]).filter(n => {
  // التحقق من أن لكل ملاحظة معرف وحقول أساسية
      return n && n.id && typeof n.id === 'string' && n.id.length > 0;
      });

      const remoteEvents = mapRemoteRows<AppEvent>(downloadResult.results[1]);
      const remoteTasks = mapRemoteRows<AppTask>(downloadResult.results[2]);
      const remoteShopping = mapRemoteRows<ShoppingList>(downloadResult.results[3]);

      // 4. Merge & Sync (Notes)
      const mergedNotes = mergeEntities(localNotes, remoteNotes);
      dbNotes.replaceAll(mergedNotes);

      // 5. Merge & Sync (Events)
      const mergedEvents = mergeEntities(localEvents, remoteEvents);
      dbEvents.replaceAll(mergedEvents);

      // 6. Merge & Sync (Tasks)
      const mergedTasks = mergeEntities(localTasks, remoteTasks);
      dbTasks.replaceAll(mergedTasks);

      // 7. Merge & Sync (Shopping)
      const mergedShopping = mergeEntities(localShopping, remoteShopping);
      dbShopping.replaceAll(mergedShopping);

      // 8. Upload merged entities back to Turso to ensure both sides are fully synced
      showToast('📤 جاري رفع ومزامنة التغييرات المحلية...');
      const uploadStatements: { sql: string; args?: any[] }[] = [];

      mergedNotes.forEach(n => {
        uploadStatements.push({
          sql: 'INSERT OR REPLACE INTO notes (id, data) VALUES (?, ?)',
          args: [n.id, JSON.stringify(n)]
        });
      });

      mergedEvents.forEach(e => {
        uploadStatements.push({
          sql: 'INSERT OR REPLACE INTO events (id, data) VALUES (?, ?)',
          args: [e.id, JSON.stringify(e)]
        });
      });

      mergedTasks.forEach(t => {
        uploadStatements.push({
          sql: 'INSERT OR REPLACE INTO tasks (id, data) VALUES (?, ?)',
          args: [t.id, JSON.stringify(t)]
        });
      });

      mergedShopping.forEach(l => {
        uploadStatements.push({
          sql: 'INSERT OR REPLACE INTO shopping_lists (id, data) VALUES (?, ?)',
          args: [l.id, JSON.stringify(l)]
        });
      });

      // Execute upload in batches of 50 to prevent huge payload issues
      const batchSize = 50;
      for (let i = 0; i < uploadStatements.length; i += batchSize) {
        const batch = uploadStatements.slice(i, i + batchSize);
        await tursoHelpers.executeBatch(config, batch);
      }

      showToast('✅ تم مزامنة البيانات مع Turso بنجاح!');
      return true;
    } catch (err) {
      console.error('[Turso] Synchronization failed:', err);
      showToast('❌ فشل مزامنة البيانات مع Turso');
      throw err;
    }
  }
};

/* ─────────────────────────────────────────────
   Internal Helper Functions
   ───────────────────────────────────────────── */

/** Helper to convert LibSQL HTTP row schema to structured objects */
function mapRemoteRows<T extends { id: string }>(res: any): T[] {
if (!res || !res.response || !res.response.result || !res.response.result.rows) return [];
const rows = res.response.result.rows;
return rows.flatMap((row: any[]) => {
try {
const dataValue = row[1]?.value;
if (typeof dataValue !== 'string') return [];
const parsed = JSON.parse(dataValue) as T;
// ✅ التحقق من وجود معرف فريد وصحة البنية الأساسية
if (!parsed.id || typeof parsed.id !== 'string') return [];
// ✅ إزالة أي حقول مريبة قد تحتوي على أكواد برمجية
const sanitized = sanitizeEntity(parsed);
return [sanitized];
} catch (err) {
if (import.meta.env.DEV) console.warn('[Turso] Failed to parse row:', err);
return [];
}
});
}

// ✅ دالة تنظيف البيانات من الحقول الخطيرة
function sanitizeEntity<T extends { id: string }>(entity: any): T {
const allowedKeys = ['id', 'title', 'content', 'category', 'color', 'createdAt', 'updatedAt', 
'isPinned', 'isFavorite', 'isArchived', 'isTrash', 'isLocked', 'isCompleted', 'checklist', 
'reminder', 'priority', 'dueDate', 'description', 'items', 'totalBudget', 'totalSpent'];
const sanitized: any = {};
for (const key of allowedKeys) {
if (key in entity) {
sanitized[key] = entity[key];
}
}
sanitized.id = entity.id;
return sanitized as T;
}


/** Merges local and remote entities based on updatedAt timestamp */
function mergeEntities<T extends { id: string; updatedAt: string }>(local: T[], remote: T[]): T[] {
  const mergedMap = new Map<string, T>();

  // Seed with local entities
  local.forEach(item => mergedMap.set(item.id, item));

  // Merge remote entities, keeping the most recently updated
  remote.forEach(remoteItem => {
    const localItem = mergedMap.get(remoteItem.id);
    if (!localItem) {
      mergedMap.set(remoteItem.id, remoteItem);
    } else {
      const localTime = new Date(localItem.updatedAt).getTime();
      const remoteTime = new Date(remoteItem.updatedAt).getTime();
      if (remoteTime > localTime) {
        mergedMap.set(remoteItem.id, remoteItem);
      }
    }
  });

  return Array.from(mergedMap.values());
}
