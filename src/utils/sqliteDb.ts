/**
 * SQLite Database Manager — Pure client-side, no backend.
 * Uses sql.js (SQLite compiled to WASM) running entirely in the browser.
 * The .db file is persisted in localStorage as an encrypted base64-encoded blob.
 */

import initSqlJs, { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { Note, AppEvent, AppTask, ShoppingList } from '../types';
import { encrypt, decrypt } from './secureCrypto';

const DB_STORAGE_KEY = 'mohafadaty_sqlite_db_v1';
const ENCRYPTION_KEY_STORAGE = 'mohafadaty_enc_key_v1';

let db: Database | null = null;
let SQL: any = null;
let _cachedKey: string | null = null;

/* ─────────────────────────────────────────────
   Base64 Persistence Helpers
   ───────────────────────────────────────────── */
const uint8ToBase64 = (arr: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
};

const base64ToUint8 = (b64: string): Uint8Array => {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
};

/* ─────────────────────────────────────────────
   Encryption Key Management
   ───────────────────────────────────────────── */
async function getEncryptionKey(): Promise<string> {
  if (_cachedKey) return _cachedKey;
  
  let key = localStorage.getItem(ENCRYPTION_KEY_STORAGE);
  if (!key) {
    // استخدام 32 بايت من القيم العشوائية الآمنة
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    key = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(ENCRYPTION_KEY_STORAGE, key);
  }
  _cachedKey = key;
  return key;
}

/* ─────────────────────────────────────────────
   Persistence Functions
   ───────────────────────────────────────────── */
const persistToLocalStorage = async (): Promise<void> => {
  if (!db) return;
  
  try {
    const data = db.export();
    const b64 = uint8ToBase64(data);
    const encrypted = await encrypt(b64, await getEncryptionKey());
    localStorage.setItem(DB_STORAGE_KEY, encrypted);
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[SQLite] Failed to save database:', err);
    }
    throw new Error('[SQLite] Failed to encrypt database for storage');
  }
};

const loadFromLocalStorage = async (): Promise<Uint8Array | null> => {
  try {
    const encrypted = localStorage.getItem(DB_STORAGE_KEY);
    if (!encrypted || typeof encrypted !== 'string') return null;
    
    // فك التشفير
    let b64: string;
    try {
      b64 = await decrypt(encrypted, await getEncryptionKey());
    } catch {
      // للتوافق مع النسخ القديمة غير المشفرة
      if (/^[A-Za-z0-9+/]*={0,2}$/.test(encrypted) && encrypted.length >= 100) {
        b64 = encrypted;
      } else {
        if (import.meta.env.DEV) console.warn('[SQLite] Decryption failed, ignoring invalid data');
        return null;
      }
    }
    
    // التحقق من صحة البيانات
    if (b64.length < 100) {
      if (import.meta.env.DEV) console.warn('[SQLite] Stored database is too small');
      return null;
    }
    
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) {
      if (import.meta.env.DEV) console.error('[SQLite] Invalid Base64 format');
      return null;
    }
    
    const uint8 = base64ToUint8(b64);
    
    if (uint8.length < 100) {
      if (import.meta.env.DEV) console.warn('[SQLite] Loaded database is too small');
      return null;
    }
    
    return uint8;
  } catch (err) {
    if (import.meta.env.DEV) console.error('[SQLite] Failed to load DB:', err);
    return null;
  }
};

/* ─────────────────────────────────────────────
   Database Initialization
   ───────────────────────────────────────────── */
export const initDatabase = async (): Promise<Database> => {
  if (db) return db;

  SQL = await initSqlJs({
    locateFile: () => sqlWasmUrl,
  });

  const existingData = await loadFromLocalStorage();
  
  if (existingData) {
    db = new SQL.Database(existingData);
    if (import.meta.env.DEV) console.log('[SQLite] Loaded existing database');
  } else {
    db = new SQL.Database();
    if (import.meta.env.DEV) console.log('[SQLite] Created fresh database');
  }

  const d = db!;

  // Create tables
  d.run(`CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
  d.run(`CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
  d.run(`CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
  d.run(`CREATE TABLE IF NOT EXISTS shopping_lists (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
  d.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);

  await persistToLocalStorage();
  return d;
};

/** Get the db instance (must call initDatabase first) */
const getDb = (): Database => {
  if (!db) throw new Error('[SQLite] Database not initialized. Call initDatabase() first.');
  return db;
};

/* ─────────────────────────────────────────────
   Table name validation — prevents SQL injection
   ───────────────────────────────────────────── */
const VALID_TABLES = ['notes', 'events', 'tasks', 'shopping_lists', 'settings'] as const;
type ValidTable = typeof VALID_TABLES[number];

const validateTableName = (table: string): ValidTable => {
  if (!VALID_TABLES.includes(table as ValidTable)) {
    throw new Error(`[SQLite] Invalid table name: ${table}`);
  }
  return table as ValidTable;
};

/* ─────────────────────────────────────────────
   Generic CRUD Operations
   ───────────────────────────────────────────── */
const getAll = <T>(table: string): T[] => {
  validateTableName(table);
  const d = getDb();
  const result = d.exec(`SELECT data FROM ${table}`);
  if (result.length === 0) return [];
  
  return result[0].values.flatMap(row => {
    try {
      const data = row[0] as string;
      return [JSON.parse(data) as T];
    } catch {
      return [];
    }
  });
};

const upsert = async (table: string, id: string, entity: unknown): Promise<void> => {
  validateTableName(table);
  const d = getDb();
  
  if (!id || typeof id !== 'string' || id.length === 0) {
    throw new Error('[SQLite] Invalid ID: must be non-empty string');
  }
  
  if (!entity || typeof entity !== 'object') {
    throw new Error('[SQLite] Invalid entity: must be object');
  }
  
  const json = JSON.stringify(entity);
  if (json.length === 0 || json === '{}') {
    throw new Error('[SQLite] Entity produced empty JSON');
  }
  
  try {
    const existing = d.exec(`SELECT id FROM ${table} WHERE id = ?`, [id]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      d.run(`UPDATE ${table} SET data = ? WHERE id = ?`, [json, id]);
    } else {
      d.run(`INSERT INTO ${table} (id, data) VALUES (?, ?)`, [id, json]);
    }
    await persistToLocalStorage();
  } catch (err) {
    console.error(`[SQLite] Upsert failed for table ${table}:`, err);
    throw new Error(`[SQLite] Failed to save data to ${table}`);
  }
};

const deleteRow = async (table: string, id: string): Promise<void> => {
  validateTableName(table);
  const d = getDb();
  d.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
  await persistToLocalStorage();
};

const clearTable = async (table: string): Promise<void> => {
  validateTableName(table);
  const d = getDb();
  d.run(`DELETE FROM ${table}`);
  await persistToLocalStorage();
};

/* ─────────────────────────────────────────────
   Notes API
   ───────────────────────────────────────────── */
export const dbNotes = {
  getAll: (): Note[] => getAll<Note>('notes'),
  save: (note: Note): Promise<void> => upsert('notes', note.id, note),
  delete: (id: string): Promise<void> => deleteRow('notes', id),
  clearAll: (): Promise<void> => clearTable('notes'),
  replaceAll: async (notes: Note[]): Promise<void> => {
    await clearTable('notes');
    for (const n of notes) {
      await upsert('notes', n.id, n);
    }
  },
};

/* ─────────────────────────────────────────────
   Events API
   ───────────────────────────────────────────── */
export const dbEvents = {
  getAll: (): AppEvent[] => getAll<AppEvent>('events'),
  save: (ev: AppEvent): Promise<void> => upsert('events', ev.id, ev),
  delete: (id: string): Promise<void> => deleteRow('events', id),
  clearAll: (): Promise<void> => clearTable('events'),
  replaceAll: async (evs: AppEvent[]): Promise<void> => {
    await clearTable('events');
    for (const e of evs) {
      await upsert('events', e.id, e);
    }
  },
};

/* ─────────────────────────────────────────────
   Tasks API
   ───────────────────────────────────────────── */
export const dbTasks = {
  getAll: (): AppTask[] => getAll<AppTask>('tasks'),
  save: (task: AppTask): Promise<void> => upsert('tasks', task.id, task),
  delete: (id: string): Promise<void> => deleteRow('tasks', id),
  clearAll: (): Promise<void> => clearTable('tasks'),
  replaceAll: async (tasks: AppTask[]): Promise<void> => {
    await clearTable('tasks');
    for (const t of tasks) {
      await upsert('tasks', t.id, t);
    }
  },
};

/* ─────────────────────────────────────────────
   Shopping Lists API
   ───────────────────────────────────────────── */
export const dbShopping = {
  getAll: (): ShoppingList[] => getAll<ShoppingList>('shopping_lists'),
  save: (list: ShoppingList): Promise<void> => upsert('shopping_lists', list.id, list),
  delete: (id: string): Promise<void> => deleteRow('shopping_lists', id),
  clearAll: (): Promise<void> => clearTable('shopping_lists'),
  replaceAll: async (lists: ShoppingList[]): Promise<void> => {
    await clearTable('shopping_lists');
    for (const l of lists) {
      await upsert('shopping_lists', l.id, l);
    }
  },
};

/* ─────────────────────────────────────────────
   Settings API (key-value store)
   ───────────────────────────────────────────── */
export const dbSettings = {
  get: (key: string): string | null => {
    const d = getDb();
    const result = d.exec(`SELECT value FROM settings WHERE key = ?`, [key]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return result[0].values[0][0] as string;
  },
  
  save: async (key: string, value: string): Promise<void> => {
    const d = getDb();
    const existing = d.exec(`SELECT key FROM settings WHERE key = ?`, [key]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      d.run(`UPDATE settings SET value = ? WHERE key = ?`, [value, key]);
    } else {
      d.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, [key, value]);
    }
    await persistToLocalStorage();
  },
  
  delete: async (key: string): Promise<void> => {
    const d = getDb();
    d.run(`DELETE FROM settings WHERE key = ?`, [key]);
    await persistToLocalStorage();
  },
};

/* ─────────────────────────────────────────────
   Export / Import the raw SQLite .db file
   ───────────────────────────────────────────── */
export const exportDbFile = (): Uint8Array | null => {
  if (!db) return null;
  return db.export();
};

export const importDbFile = async (data: Uint8Array): Promise<void> => {
  if (!SQL) throw new Error('[SQLite] SQL.js not initialized');
  db = new SQL.Database(data);
  await persistToLocalStorage();
};

/** Get the base64 blob string (for backup JSON) */
export const getDbBase64 = async (): Promise<string | null> => {
  if (!db) return null;
  const data = db.export();
  const b64 = uint8ToBase64(data);
  return encrypt(b64, await getEncryptionKey());
};

/** Restore from base64 blob string */
export const restoreDbFromBase64 = async (b64: string): Promise<void> => {
  if (!SQL) throw new Error('[SQLite] SQL.js not initialized');
  
  // فك التشفير
  let rawB64: string;
  try {
    rawB64 = await decrypt(b64, await getEncryptionKey());
  } catch {
    rawB64 = b64; // fallback للتوافق
  }
  
  const data = base64ToUint8(rawB64);
  db = new SQL.Database(data);
  await persistToLocalStorage();
};

/** Clear all data and reset database */
export const resetDatabase = async (): Promise<void> => {
  if (db) {
    db.run(`DELETE FROM notes`);
    db.run(`DELETE FROM events`);
    db.run(`DELETE FROM tasks`);
    db.run(`DELETE FROM shopping_lists`);
    db.run(`DELETE FROM settings`);
    await persistToLocalStorage();
  }
};

/** Close database connection */
export const closeDatabase = (): void => {
  if (db) {
    db.close();
    db = null;
  }
};
