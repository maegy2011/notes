/**
 * SQLite Database Manager — Pure client-side, no backend.
 * Uses sql.js (SQLite compiled to WASM) running entirely in the browser.
 * The .db file is persisted in localStorage as a base64-encoded blob.
 */

import initSqlJs, { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { Note, AppEvent, AppTask, ShoppingList } from '../types';
import { encrypt } from './secureCrypto'; // سننشئ هذا الملف لاحقًا


const DB_STORAGE_KEY = 'mohafadaty_sqlite_db_v1';

let db: Database | null = null;
let SQL: any = null;

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


const persistToLocalStorage = async (): Promise<void> => {
  if (!db) return;
  try {
    const data = db.export();
    const b64 = uint8ToBase64(data);
    const encrypted = await encrypt(b64, await getEncryptionKey());
    localStorage.setItem(DB_STORAGE_KEY, encrypted);
  } catch (err) {
    // Fallback: store unencrypted if encryption fails (dev only)
    if (import.meta.env.DEV) {
      console.warn('[SQLite] Encryption failed, storing plain:', err);
      const data = db.export();
      const b64 = uint8ToBase64(data);
      localStorage.setItem(DB_STORAGE_KEY, b64);
    }
  }
};

// helper: استخدم مفتاحًا ثابتًا أو مشتقًا من كلمة مرور المستخدم
async function getEncryptionKey(): Promise<string> {
  // يمكن تخزين المفتاح في sessionStorage أو استخلاصه من PIN
  let key = sessionStorage.getItem('app_encryption_key');
  if (!key) {
    key = crypto.randomUUID();
    sessionStorage.setItem('app_encryption_key', key);
  }
  return key;
}
const loadFromLocalStorage = async (): Promise<Uint8Array | null> => {
  try {
    const encrypted = localStorage.getItem(DB_STORAGE_KEY);
    if (!encrypted || typeof encrypted !== 'string') return null;
    
    // فك التشفير أولاً
    let b64: string;
    try {
      b64 = await decrypt(encrypted, await getEncryptionKey());
    } catch {
      // إذا فشل فك التشفير، حاول قراءة البيانات مباشرة (للتوافق مع النسخ القديمة)
      b64 = encrypted;
    }
    
    // التحقق من طول Base64 المعقول
    if (b64.length < 100) {
      if (import.meta.env.DEV) console.warn('[SQLite] Stored database is suspiciously small, ignoring');
      return null;
    }
    // التحقق من صيغة Base64 الصحيحة
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) {
      if (import.meta.env.DEV) console.error('[SQLite] Invalid Base64 format');
      return null;
    }
    let uint8: Uint8Array;
    try {
      uint8 = base64ToUint8(b64);
    } catch (decodeErr) {
      if (import.meta.env.DEV) console.error('[SQLite] Failed to decode Base64:', decodeErr);
      return null;
    }
    // التحقق من أن البيانات المفكوكة معقولة
    if (uint8.length < 100) {
      if (import.meta.env.DEV) console.warn('[SQLite] Loaded database is suspiciously small');
      return null;
    }
    return uint8;
  } catch (err) {
    if (import.meta.env.DEV) console.error('[SQLite] Failed to load DB from storage:', err);
    return null;
  }
};



/* ─────────────────────────────────────────────
   Database Initialization
   ───────────────────────────────────────────── */
export const initDatabase = async (): Promise<Database> => {
  if (db) return db;

  SQL = await initSqlJs({
    // Vite resolves the WASM file into a deploy-safe asset/data URL.
    // This avoids 404s such as sql-wasm-browser.wasm and avoids relying on a CDN.
    locateFile: () => sqlWasmUrl,
  });

  const existingData = loadFromLocalStorage();
  if (existingData) {
    db = new SQL.Database(existingData);
    // لا تسجّل في الإنتاج
    if (import.meta.env.DEV) console.log('[SQLite] Loaded existing database');
  } else {
    db = new SQL.Database();
    if (import.meta.env.DEV) console.log('[SQLite] Created fresh database');
  }

  const d = db!;

  // Create tables (IF NOT EXISTS ensures idempotent)
  d.run(`CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
  d.run(`CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
  d.run(`CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
  d.run(`CREATE TABLE IF NOT EXISTS shopping_lists (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
  d.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);

  persistToLocalStorage();
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
   Generic JSON-blob CRUD helpers
   Each entity is stored as { id, data: JSON.stringify(entity) }
   This keeps SQL simple and avoids column-mismatch issues.
   ───────────────────────────────────────────── */
const upsert = (table: string, id: string, entity: any) => {
validateTableName(table);
const d = getDb();
// ✅ التحقق من صحة المعرف
if (!id || typeof id !== 'string' || id.length === 0) {
throw new Error('[SQLite] Invalid ID: must be non-empty string');
}
// ✅ التحقق من أن entity ليس null أو undefined
if (!entity || typeof entity !== 'object') {
throw new Error('[SQLite] Invalid entity: must be object');
}
// ✅ التحقق من أن JSON.stringify لا ينتج عنه string فارغة
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
persistToLocalStorage();
} catch (err) {
console.error(`[SQLite] Upsert failed for table ${table}:`, err);
throw new Error(`[SQLite] Failed to save data to ${table}`);
}
};


const getAll = <T>(table: string): T[] => {
  validateTableName(table);
  const d = getDb();
  const result = d.exec(`SELECT data FROM ${table}`);
  if (result.length === 0) return [];
  return result[0].values.map((row: any[]) => JSON.parse(row[0] as string) as T);
};

const deleteRow = (table: string, id: string) => {
  validateTableName(table);
  const d = getDb();
  d.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
  persistToLocalStorage();
};

const clearTable = (table: string) => {
  validateTableName(table);
  const d = getDb();
  d.run(`DELETE FROM ${table}`);
  persistToLocalStorage();
};

/* ─────────────────────────────────────────────
   Notes API
   ───────────────────────────────────────────── */
export const dbNotes = {
  getAll: (): Note[] => getAll<Note>('notes'),
  save: (note: Note) => upsert('notes', note.id, note),
  delete: (id: string) => deleteRow('notes', id),
  clearAll: () => clearTable('notes'),
  /** Replace all notes (used by import) */
  replaceAll: (notes: Note[]) => {
    clearTable('notes');
    notes.forEach(n => upsert('notes', n.id, n));
  },
};

/* ─────────────────────────────────────────────
   Events API
   ───────────────────────────────────────────── */
export const dbEvents = {
  getAll: (): AppEvent[] => getAll<AppEvent>('events'),
  save: (ev: AppEvent) => upsert('events', ev.id, ev),
  delete: (id: string) => deleteRow('events', id),
  clearAll: () => clearTable('events'),
  replaceAll: (evs: AppEvent[]) => {
    clearTable('events');
    evs.forEach(e => upsert('events', e.id, e));
  },
};

/* ─────────────────────────────────────────────
   Tasks API
   ───────────────────────────────────────────── */
export const dbTasks = {
  getAll: (): AppTask[] => getAll<AppTask>('tasks'),
  save: (task: AppTask) => upsert('tasks', task.id, task),
  delete: (id: string) => deleteRow('tasks', id),
  clearAll: () => clearTable('tasks'),
  replaceAll: (tasks: AppTask[]) => {
    clearTable('tasks');
    tasks.forEach(t => upsert('tasks', t.id, t));
  },
};

/* ─────────────────────────────────────────────
   Shopping Lists API
   ───────────────────────────────────────────── */
export const dbShopping = {
  getAll: (): ShoppingList[] => getAll<ShoppingList>('shopping_lists'),
  save: (list: ShoppingList) => upsert('shopping_lists', list.id, list),
  delete: (id: string) => deleteRow('shopping_lists', id),
  clearAll: () => clearTable('shopping_lists'),
  replaceAll: (lists: ShoppingList[]) => {
    clearTable('shopping_lists');
    lists.forEach(l => upsert('shopping_lists', l.id, l));
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
  save: (key: string, value: string) => {
    const d = getDb();
    const existing = d.exec(`SELECT key FROM settings WHERE key = ?`, [key]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      d.run(`UPDATE settings SET value = ? WHERE key = ?`, [value, key]);
    } else {
      d.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, [key, value]);
    }
    persistToLocalStorage();
  },
  delete: (key: string) => {
    const d = getDb();
    d.run(`DELETE FROM settings WHERE key = ?`, [key]);
    persistToLocalStorage();
  },
};

/* ─────────────────────────────────────────────
   Export / Import the raw SQLite .db file
   ───────────────────────────────────────────── */
export const exportDbFile = (): Uint8Array | null => {
  if (!db) return null;
  return db.export();
};

export const importDbFile = (data: Uint8Array) => {
  if (!SQL) throw new Error('[SQLite] SQL.js not initialized');
  db = new SQL.Database(data);
  persistToLocalStorage();
};

/** Get the base64 blob string (for backup JSON) */
export const getDbBase64 = (): string | null => {
  return localStorage.getItem(DB_STORAGE_KEY);
};

/** Restore from base64 blob string */
export const restoreDbFromBase64 = (b64: string) => {
  localStorage.setItem(DB_STORAGE_KEY, b64);
  if (SQL) {
    const data = base64ToUint8(b64);
    db = new SQL.Database(data);
  }
};
