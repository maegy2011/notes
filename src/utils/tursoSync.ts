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

export const tursoHelpers = {
  getConfig: (): TursoConfig => {
    try {
      const data = localStorage.getItem(CONFIG_KEY);
      if (data) return JSON.parse(data);
    } catch {}
    return { url: '', token: '', autoSync: false };
  },

  saveConfig: (cfg: TursoConfig) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  },

  sanitizeUrl: (url: string): string => {
    let sanitized = url.trim();
    if (sanitized.startsWith('libsql://')) {
      sanitized = sanitized.replace('libsql://', 'https://');
    }
    // Ensure HTTPS
    if (!sanitized.startsWith('https://') && !sanitized.startsWith('http://')) {
      sanitized = 'https://' + sanitized;
    }
    if (sanitized.endsWith('/')) sanitized = sanitized.slice(0, -1);
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

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `HTTP ${response.status}`);
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

      const remoteNotes = mapRemoteRows<Note>(downloadResult.results[0]);
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
function mapRemoteRows<T>(res: any): T[] {
  if (!res || !res.response || !res.response.result || !res.response.result.rows) return [];
  const rows = res.response.result.rows;
  return rows.map((row: any[]) => {
    const dataValue = row[1]?.value;
    return JSON.parse(dataValue) as T;
  });
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
