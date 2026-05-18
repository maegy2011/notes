import { dbNotes, dbEvents, dbTasks, dbShopping } from './sqliteDb';
import { Note, AppEvent, AppTask, ShoppingList } from '../types';

export interface TursoConfig {
  url: string;
  token: string;
  autoSync: boolean;
}

interface SQLStatement {
  sql: string;
  args?: unknown[];
}

const CONFIG_KEY = 'notes_app_turso_config_v1';
const TOKEN_SESSION_KEY = 'turso_token_tmp';
const BATCH_SIZE = 50;
const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;

/* ─────────────────────────────────────────────
   Rate Limiter لمنع الإساءة
   ───────────────────────────────────────────── */
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
  
  getRemainingTime(): number {
    if (this.timestamps.length === 0) return 0;
    const oldest = Math.min(...this.timestamps);
    return Math.max(0, this.windowMs - (Date.now() - oldest));
  }
}

const syncLimiter = new RateLimiter(5, 60_000);

/* ─────────────────────────────────────────────
   Fetch مع Timeout
   ───────────────────────────────────────────── */
const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

/* ─────────────────────────────────────────────
   Turso Helper Functions
   ───────────────────────────────────────────── */
export const tursoHelpers = {
  getConfig: (): TursoConfig => {
    try {
      const data = localStorage.getItem(CONFIG_KEY);
      const cfg = data ? JSON.parse(data) : { url: '', autoSync: false };
      
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
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[Turso] Failed to parse config:', err);
      return { url: '', token: '', autoSync: false };
    }
  },

  saveConfig: (cfg: TursoConfig): void => {
    const { token, ...safeConfig } = cfg;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(safeConfig));
    
    if (token) {
      const tokenData = JSON.stringify({
        value: token,
        expiresAt: Date.now() + 8 * 60 * 60 * 1000
      });
      sessionStorage.setItem(TOKEN_SESSION_KEY, tokenData);
    }
  },

  clearToken: (): void => {
    sessionStorage.removeItem(TOKEN_SESSION_KEY);
  },

  sanitizeUrl: (url: string): string => {
    let sanitized = url.trim();
    if (sanitized.startsWith('libsql://')) sanitized = sanitized.replace('libsql://', 'https://');
    if (sanitized.startsWith('http://')) sanitized = sanitized.replace('http://', 'https://');
    if (!sanitized.startsWith('https://')) sanitized = 'https://' + sanitized;
    if (sanitized.endsWith('/')) sanitized = sanitized.slice(0, -1);
    
    try {
      const hostname = new URL(sanitized).hostname;
      const isTursoDomain = 
        hostname === 'turso.io' || 
        hostname.endsWith('.turso.io') ||
        hostname.endsWith('.turso.dev') ||
        hostname === 'api.turso.io';
      
      if (!isTursoDomain) {
        throw new Error('رابط غير صالح: يجب أن ينتمي لنطاق turso.io أو turso.dev');
      }
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'رابط قاعدة بيانات غير صالح');
    }
    
    return sanitized;
  },

  executeBatch: async (
    config: TursoConfig,
    statements: SQLStatement[],
    retryCount = 0
  ): Promise<unknown> => {
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
        stmt: { sql: stmt.sql, args: args.length > 0 ? args : undefined }
      };
    });

    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      }, DEFAULT_TIMEOUT_MS);

      if (!response.ok) {
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
    } catch (err) {
      if (retryCount < MAX_RETRIES && err instanceof Error && 
          (err.message.includes('network') || err.message.includes('timeout'))) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return tursoHelpers.executeBatch(config, statements, retryCount + 1);
      }
      throw err;
    }
  },

  testConnection: async (config: TursoConfig): Promise<boolean> => {
    if (!config.url || !config.token) return false;
    try {
      await tursoHelpers.executeBatch(config, [{ sql: 'SELECT 1' }]);
      return true;
    } catch (err) {
      if (import.meta.env.DEV) console.error('[Turso] Test connection failed:', err);
      throw err;
    }
  },

  bootstrapTables: async (config: TursoConfig): Promise<void> => {
    await tursoHelpers.executeBatch(config, [
      { sql: `CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, data TEXT)` },
      { sql: `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, data TEXT)` },
      { sql: `CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, data TEXT)` },
      { sql: `CREATE TABLE IF NOT EXISTS shopping_lists (id TEXT PRIMARY KEY, data TEXT)` },
    ]);
  },

  syncNow: async (config: TursoConfig, showToast: (msg: string) => void): Promise<boolean> => {
    if (!config.url || !config.token) return false;

    if (!syncLimiter.isAllowed()) {
      const remaining = Math.ceil(syncLimiter.getRemainingTime() / 1000);
      showToast(`⏸️ الرجاء الانتظار ${remaining} ثانية قبل المزامنة مرة أخرى`);
      return false;
    }

    try {
      showToast('🔄 جاري الاتصال بقاعدة بيانات Turso...');
      await tursoHelpers.bootstrapTables(config);

      const localNotes = dbNotes.getAll();
      const localEvents = dbEvents.getAll();
      const localTasks = dbTasks.getAll();
      const localShopping = dbShopping.getAll();

      showToast('📥 جاري تنزيل البيانات السحابية...');

      const downloadResult = await tursoHelpers.executeBatch(config, [
        { sql: 'SELECT id, data FROM notes' },
        { sql: 'SELECT id, data FROM events' },
        { sql: 'SELECT id, data FROM tasks' },
        { sql: 'SELECT id, data FROM shopping_lists' }
      ]) as { results: unknown[] };

      // تأكيد الفلترة المشددة للبيانات الواردة
      const remoteNotes = mapRemoteRows<Note>(downloadResult.results[0]).filter(isValidEntity);
      const remoteEvents = mapRemoteRows<AppEvent>(downloadResult.results[1]).filter(isValidEntity);
      const remoteTasks = mapRemoteRows<AppTask>(downloadResult.results[2]).filter(isValidEntity);
      const remoteShopping = mapRemoteRows<ShoppingList>(downloadResult.results[3]).filter(isValidEntity);

      showToast('🔀 جاري دمج البيانات...');
      
      const mergedNotes = mergeEntities(localNotes, remoteNotes);
      await dbNotes.replaceAll(mergedNotes);

      const mergedEvents = mergeEntities(localEvents, remoteEvents);
      await dbEvents.replaceAll(mergedEvents);

      const mergedTasks = mergeEntities(localTasks, remoteTasks);
      await dbTasks.replaceAll(mergedTasks);

      const mergedShopping = mergeEntities(localShopping, remoteShopping);
      await dbShopping.replaceAll(mergedShopping);

      showToast('📤 جاري رفع التغييرات...');
      
      const uploadStatements: SQLStatement[] = [];

      mergedNotes.forEach(n => uploadStatements.push({ sql: 'INSERT OR REPLACE INTO notes (id, data) VALUES (?, ?)', args: [n.id, JSON.stringify(n)] }));
      mergedEvents.forEach(e => uploadStatements.push({ sql: 'INSERT OR REPLACE INTO events (id, data) VALUES (?, ?)', args: [e.id, JSON.stringify(e)] }));
      mergedTasks.forEach(t => uploadStatements.push({ sql: 'INSERT OR REPLACE INTO tasks (id, data) VALUES (?, ?)', args: [t.id, JSON.stringify(t)] }));
      mergedShopping.forEach(l => uploadStatements.push({ sql: 'INSERT OR REPLACE INTO shopping_lists (id, data) VALUES (?, ?)', args: [l.id, JSON.stringify(l)] }));

      for (let i = 0; i < uploadStatements.length; i += BATCH_SIZE) {
        const batch = uploadStatements.slice(i, i + BATCH_SIZE);
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

function isValidEntity<T extends { id: string }>(entity: T | null | undefined): entity is T {
  return entity !== null && 
         entity !== undefined && 
         !!entity.id && 
         typeof entity.id === 'string' && 
         entity.id.length > 0;
}

function mapRemoteRows<T extends { id: string }>(res: unknown): T[] {
  if (!res || typeof res !== 'object') return [];
  const result = res as { response?: { result?: { rows?: unknown[] } } };
  if (!result.response?.result?.rows) return [];
  
  const rows = result.response.result.rows as unknown[][];
  
  return rows.flatMap((row: unknown[]) => {
    try {
      if (!Array.isArray(row) || row.length < 2) return [];
      const dataValue = (row[1] as { value?: string })?.value;
      if (typeof dataValue !== 'string') return [];
      
      const parsed = JSON.parse(dataValue) as T;
      if (!parsed.id || typeof parsed.id !== 'string') return [];
      
      const sanitized = sanitizeEntity(parsed);
      return isValidEntity(sanitized) ? [sanitized] : [];
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[Turso] Failed to parse row:', err);
      return [];
    }
  });
}

function sanitizeEntity<T extends { id: string }>(entity: T): T {
  if (!entity || typeof entity !== 'object') return entity;
  
  const allowedKeys = new Set([
    'id', 'title', 'content', 'category', 'color', 'createdAt', 'updatedAt',
    'isPinned', 'isFavorite', 'isArchived', 'isTrash', 'isLocked', 'isCompleted', 
    'checklist', 'reminder', 'priority', 'dueDate', 'reminderAt', 'description', 
    'items', 'totalBudget', 'totalSpent', 'deletedAt', 'name', 'store', 'budget', 
    'allDay', 'startDatetime', 'endDatetime', 'location', 'repeat', 'qty', 'unit', 
    'price', 'note', 'checked', 'addedAt', 'text', 'completed', 'type', 'datetime'
  ]);
  
  const sanitized: Record<string, unknown> = {};
  
  for (const key of Object.keys(entity)) {
    if (allowedKeys.has(key)) {
      const value = (entity as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.length > 100000) continue;
      sanitized[key] = value;
    }
  }
  
  if (!sanitized.id || typeof sanitized.id !== 'string') return entity;
  return sanitized as T;
}

function mergeEntities<T extends { id: string; updatedAt: string }>(
  local: T[], 
  remote: T[],
  deletedIds?: Set<string>
): T[] {
  const mergedMap = new Map<string, T>();
  local.forEach(item => mergedMap.set(item.id, item));
  
  remote.forEach(remoteItem => {
    if (deletedIds?.has(remoteItem.id)) return;
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