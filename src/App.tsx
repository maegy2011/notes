import React, { useState, useEffect, useCallback } from 'react';
import { Note, TabType, ThemeMode, AppEvent, AppTask, ShoppingList } from './types';
import { AppSettings } from './components/StatsView';
import { INITIAL_NOTES, CATEGORY_LABELS } from './data/initialNotes';
import { MobileHeader } from './components/MobileHeader';
import { BottomNav } from './components/BottomNav';
import { NoteCard, ViewMode } from './components/NoteCard';
import { NoteEditor } from './components/NoteEditor';
import { NoteDetailModal } from './components/NoteDetailModal';
import { StatsView } from './components/StatsView';
import { Toast } from './components/Toast';
import { AdvancedSearch, SearchFilters } from './components/AdvancedSearch';
import { PinLock, lockHelpers } from './components/PinLock';
import { CalendarView } from './components/CalendarView';
import { EventEditor } from './components/EventEditor';
import { EventDetailModal } from './components/EventDetailModal';
import { TaskView } from './components/TaskView';
import { TaskEditor } from './components/TaskEditor';
import { ShoppingView } from './components/ShoppingView';
import { EnhancedFAB } from './components/EnhancedFAB';
import {
  shareContent, formatNoteForShare, formatTaskForShare, formatEventForShare, formatShoppingListForShare,
  duplicateNote, duplicateTask, duplicateEvent, duplicateShoppingList, uid,
} from './utils/shareDuplicate';
import { initDatabase, dbNotes, dbEvents, dbTasks, dbShopping } from './utils/sqliteDb';
import { tursoHelpers } from './utils/tursoSync';
import { Plus, LayoutGrid, List, Archive, RefreshCw, Trash2, CheckSquare, AlignLeft, Layout, Lock as LockIcon, Unlock as UnlockIcon, Bell, CalendarClock, ListTodo } from 'lucide-react';

const defaultFilters: SearchFilters = {
  query: '',
  categories: [],
  colors: [],
  hasChecklist: null,
  isPinned: null,
  isFavorite: null,
  isArchived: null,
  dateFrom: '',
  dateTo: '',
  sortBy: 'updatedAt',
  sortOrder: 'desc'
};

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [tasks, setTasks] = useState<AppTask[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);

  const [activeTab, setActiveTab] = useState<TabType>('notes');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState<boolean>(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(defaultFilters);
  const [searchResults, setSearchResults] = useState<Note[] | null>(null);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState<boolean>(false);

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentEditNote, setCurrentEditNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // ─── Events state ───
  const [isEventEditorOpen, setIsEventEditorOpen] = useState(false);
  const [currentEditEvent, setCurrentEditEvent] = useState<AppEvent | null>(null);
  const [viewingEvent, setViewingEvent] = useState<AppEvent | null>(null);
  const [newEventDate, setNewEventDate] = useState<Date | undefined>(undefined);

  // ─── Tasks state ───
  const [isTaskEditorOpen, setIsTaskEditorOpen] = useState(false);
  const [currentEditTask, setCurrentEditTask] = useState<AppTask | null>(null);

  // ─── Initialize SQLite WASM Database & Load Data ───
  useEffect(() => {
    const bootDatabase = async () => {
      await initDatabase();

      // 1. Load Notes from SQLite
      let sqlNotes = dbNotes.getAll();
      if (sqlNotes.length === 0) {
        INITIAL_NOTES.forEach(n => dbNotes.save(n));
        sqlNotes = dbNotes.getAll();
      }
      setNotes(sqlNotes);

      // 2. Load Events from SQLite
      const sqlEvents = dbEvents.getAll();
      setEvents(sqlEvents);

      // 3. Load Tasks
      const sqlTasks = dbTasks.getAll();
      setTasks(sqlTasks);

      // 4. Load Shopping Lists
      const sqlShopping = dbShopping.getAll();
      setShoppingLists(sqlShopping);

      setDbReady(true);

      // Sync on launch if configured in settings
      try {
        const settingsSaved = localStorage.getItem('notes_app_settings_v1');
        if (settingsSaved) {
          const parsed = JSON.parse(settingsSaved);
          if (parsed.syncOnLaunch) {
            const cfg = tursoHelpers.getConfig();
            if (cfg.url && cfg.token) {
              // Trigger background silent sync on launch
              (async () => {
                try {
                  await tursoHelpers.syncNow(cfg, () => {});
                  // Reload data once synced
                  setNotes(dbNotes.getAll());
                  setEvents(dbEvents.getAll());
                  setTasks(dbTasks.getAll());
                  setShoppingLists(dbShopping.getAll());
                } catch (err) {
                  if (import.meta.env.DEV) console.warn('[Turso Sync On Launch] Failed background sync:', err);
                }
              })();
            }
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[Boot Sync Error]', err);
      }
    };
    bootDatabase();
  }, []);

  // ─── Events SQL Operations ───
  const handleSaveEvent = (data: Omit<AppEvent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const now = new Date().toISOString();
    let newEv: AppEvent;
    if (data.id) {
      newEv = {
        ...events.find(e => e.id === data.id)!,
        ...data,
        updatedAt: now,
      } as AppEvent;
      setEvents(prev => prev.map(e => e.id === data.id ? newEv : e));
      showToast('تم تحديث الحدث بنجاح');
    } else {
      newEv = {
        ...(data as Omit<AppEvent, 'id' | 'createdAt' | 'updatedAt'>),
        id: uid(),
        createdAt: now,
        updatedAt: now,
      };
      setEvents(prev => [newEv, ...prev]);
      showToast('تمت إضافة الحدث الجديد');
    }
    
    // Sync with SQLite DB
    dbEvents.save(newEv);

    setIsEventEditorOpen(false);
    setCurrentEditEvent(null);
    setNewEventDate(undefined);
    triggerAutoSync();
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    // Sync with SQLite DB
    dbEvents.delete(id);
    showToast('تم حذف الحدث');
    if (viewingEvent?.id === id) setViewingEvent(null);
    triggerAutoSync();
  };

  const handleToggleEventComplete = (id: string) => {
    setEvents(prev => prev.map(e => {
      if (e.id === id) {
        const done = !e.isCompleted;
        showToast(done ? '✅ تم تحديد الحدث كمنجز' : 'تم إلغاء الإنجاز');
        const updated = { ...e, isCompleted: done, updatedAt: new Date().toISOString() };
        // Sync with SQLite DB
        dbEvents.save(updated);
        if (viewingEvent?.id === id) setViewingEvent(updated);
        triggerAutoSync();
        return updated;
      }
      return e;
    }));
  };

  // ─── Tasks SQL Operations ───
  const handleSaveTask = (data: Omit<AppTask, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const now = new Date().toISOString();
    let newT: AppTask;
    if (data.id) {
      newT = {
        ...tasks.find(t => t.id === data.id)!,
        ...data,
        updatedAt: now,
      } as AppTask;
      setTasks(prev => prev.map(t => t.id === data.id ? newT : t));
      showToast('تم تحديث المهمة بنجاح');
    } else {
      newT = {
        ...(data as Omit<AppTask, 'id' | 'createdAt' | 'updatedAt'>),
        id: uid(),
        createdAt: now,
        updatedAt: now,
      };
      setTasks(prev => [newT, ...prev]);
      showToast('تمت إضافة المهمة الجديدة');
    }

    // Sync with SQLite DB
    dbTasks.save(newT);

    setIsTaskEditorOpen(false);
    setCurrentEditTask(null);
    triggerAutoSync();
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    // Sync with SQLite DB
    dbTasks.delete(id);
    showToast('تم حذف المهمة');
    triggerAutoSync();
  };

  const handleToggleTaskComplete = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const done = !t.isCompleted;
        showToast(done ? '✅ تم إنجاز المهمة' : 'تم إلغاء الإنجاز');
        const updated = { ...t, isCompleted: done, updatedAt: new Date().toISOString() };
        // Sync with SQLite DB
        dbTasks.save(updated);
        triggerAutoSync();
        return updated;
      }
      return t;
    }));
  };

  // ─── Shopping Lists SQL Operations ───
  const handleSaveShoppingLists = (updatedLists: ShoppingList[]) => {
    setShoppingLists(updatedLists);
    // Clear all shopping lists in SQLite and save fresh array to maintain correct state
    dbShopping.clearAll();
    updatedLists.forEach(l => dbShopping.save(l));
    triggerAutoSync();
  };

  // Advanced App Settings state
  const SETTINGS_STORAGE_KEY = 'notes_app_settings_v1';
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      syncOnLaunch: true,
      defaultScreen: 'notes',
      defaultColor: 'amber',
      defaultFontType: 'cairo',
      defaultFontSize: 'base',
      listItemHeight: 'normal',
      defaultSortOrder: 'updatedAt',
    };
  });

  // Apply settings to DOM dynamically
  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

    // 1. Apply font type class
    const fontClasses = ['font-cairo', 'font-mono', 'font-sans', 'font-serif'];
    document.documentElement.classList.remove(...fontClasses);
    if (settings.defaultFontType === 'monospace') document.documentElement.classList.add('font-mono');
    else if (settings.defaultFontType === 'sans-serif') document.documentElement.classList.add('font-sans');
    else if (settings.defaultFontType === 'serif') document.documentElement.classList.add('font-serif');
    else document.documentElement.classList.add('font-cairo');

    // 2. Apply list item height & font size classes globally if needed or locally
  }, [settings]);

  // Set initial default screen on mount if enabled
  useEffect(() => {
    if (settings.defaultScreen) {
      setActiveTab(settings.defaultScreen as TabType);
    }
  }, []);

  // Theme Mode state
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('notes_app_theme_v1') as ThemeMode) || 'system';
  });

  useEffect(() => {
    localStorage.setItem('notes_app_theme_v1', themeMode);
    const applyTheme = () => {
      let isLight = false;
      if (themeMode === 'light') {
        isLight = true;
      } else if (themeMode === 'dark') {
        isLight = false;
      } else {
        isLight = !window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      if (isLight) {
        document.body.classList.add('light');
      } else {
        document.body.classList.remove('light');
      }
    };
    applyTheme();

    if (themeMode === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [themeMode]);

  // Lock system state
  const [pinLockMode, setPinLockMode] = useState<'set' | 'unlock' | 'verify' | 'lock_all' | 'unlock_all' | null>(null);
  const [noteToUnlock, setNoteToUnlock] = useState<Note | null>(null);
  const [appLocked, setAppLocked] = useState(() => lockHelpers.isAppLockEnabled());
  // Sync locked notes with localStorage and notes state
  useEffect(() => {
    const lockedIds = lockHelpers.getLockedNoteIds();
    
    setNotes(prev => prev.map(n => ({
      ...n,
      isLocked: lockedIds.includes(n.id)
    })));

    // Check if app lock is enabled
    if (lockHelpers.isAppLockEnabled()) {
      setPinLockMode('verify');
    }
  }, []);

  useEffect(() => {
    const handleSelectNote = (e: Event) => {
      const noteId = (e as CustomEvent).detail;
      const note = notes.find(n => n.id === noteId);
      if (note) {
        setViewingNote(note);
      }
    };
    window.addEventListener('selectNote', handleSelectNote);
    
    const handleToggleSort = () => setIsSortMenuOpen(prev => !prev);
    window.addEventListener('toggleSortMenu', handleToggleSort);

    return () => {
      window.removeEventListener('selectNote', handleSelectNote);
      window.removeEventListener('toggleSortMenu', handleToggleSort);
    };
  }, [notes]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(prev => prev === msg ? null : prev);
    }, 2500);
  };

  const triggerAutoSync = async () => {
    const cfg = tursoHelpers.getConfig();
    if (cfg.url && cfg.token && cfg.autoSync) {
      try {
        // Silent background sync
        await tursoHelpers.bootstrapTables(cfg);
        
        // Get local SQLite entities
        const localNotes = dbNotes.getAll();
        const localEvents = dbEvents.getAll();
        const localTasks = dbTasks.getAll();
        const localShopping = dbShopping.getAll();

        // Merge and Sync (standard pipeline call)
        const downloadResult = await tursoHelpers.executeBatch(cfg, [
          { sql: 'SELECT id, data FROM notes' },
          { sql: 'SELECT id, data FROM events' },
          { sql: 'SELECT id, data FROM tasks' },
          { sql: 'SELECT id, data FROM shopping_lists' }
        ]);

        const remoteNotes = downloadResult.results[0]?.response?.result?.rows?.map((r: any[]) => JSON.parse(r[1]?.value)) || [];
        const remoteEvents = downloadResult.results[1]?.response?.result?.rows?.map((r: any[]) => JSON.parse(r[1]?.value)) || [];
        const remoteTasks = downloadResult.results[2]?.response?.result?.rows?.map((r: any[]) => JSON.parse(r[1]?.value)) || [];
        const remoteShopping = downloadResult.results[3]?.response?.result?.rows?.map((r: any[]) => JSON.parse(r[1]?.value)) || [];

        // Merge Notes
        const mergedNotes = mergeEntitiesLocal(localNotes, remoteNotes);
        dbNotes.replaceAll(mergedNotes);
        setNotes(mergedNotes);

        // Merge Events
        const mergedEvents = mergeEntitiesLocal(localEvents, remoteEvents);
        dbEvents.replaceAll(mergedEvents);
        setEvents(mergedEvents);

        // Merge Tasks
        const mergedTasks = mergeEntitiesLocal(localTasks, remoteTasks);
        dbTasks.replaceAll(mergedTasks);
        setTasks(mergedTasks);

        // Merge Shopping
        const mergedShopping = mergeEntitiesLocal(localShopping, remoteShopping);
        dbShopping.replaceAll(mergedShopping);
        setShoppingLists(mergedShopping);

        // Upload back
        const uploadStatements: { sql: string; args?: any[] }[] = [];
        mergedNotes.forEach(n => uploadStatements.push({ sql: 'INSERT OR REPLACE INTO notes (id, data) VALUES (?, ?)', args: [n.id, JSON.stringify(n)] }));
        mergedEvents.forEach(e => uploadStatements.push({ sql: 'INSERT OR REPLACE INTO events (id, data) VALUES (?, ?)', args: [e.id, JSON.stringify(e)] }));
        mergedTasks.forEach(t => uploadStatements.push({ sql: 'INSERT OR REPLACE INTO tasks (id, data) VALUES (?, ?)', args: [t.id, JSON.stringify(t)] }));
        mergedShopping.forEach(l => uploadStatements.push({ sql: 'INSERT OR REPLACE INTO shopping_lists (id, data) VALUES (?, ?)', args: [l.id, JSON.stringify(l)] }));

        if (uploadStatements.length > 0) {
          await tursoHelpers.executeBatch(cfg, uploadStatements);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[Turso Auto-Sync] Background synchronization failed silently:', err);
      }
    }
  };

  // Helper for merging
  const mergeEntitiesLocal = <T extends { id: string; updatedAt: string }>(local: T[], remote: T[]): T[] => {
    const mergedMap = new Map<string, T>();
    local.forEach(item => mergedMap.set(item.id, item));
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
  };

  const handleSaveNote = (noteData: Partial<Note>) => {
    const timestamp = new Date().toISOString();
    let updatedNote: Note;

    if (currentEditNote) {
      updatedNote = {
        ...notes.find(n => n.id === currentEditNote.id)!,
        ...noteData,
        updatedAt: timestamp
      } as Note;
      setNotes(prev => prev.map(n => n.id === currentEditNote.id ? updatedNote : n));
      showToast('تم تحديث الملاحظة بنجاح');
      if (viewingNote && viewingNote.id === currentEditNote.id) {
        setViewingNote(updatedNote);
      }
    } else {
      updatedNote = {
        id: uid(),
        title: noteData.title || 'ملاحظة جديدة',
        content: noteData.content || '',
        category: noteData.category || 'ideas',
        color: noteData.color || 'amber',
        createdAt: timestamp,
        updatedAt: timestamp,
        isPinned: false,
        isFavorite: false,
        isArchived: false,
        isTrash: false,
        isLocked: false,
        checklist: noteData.checklist,
        reminder: noteData.reminder
      };
      setNotes(prev => [updatedNote, ...prev]);
      showToast('تمت إضافة الملاحظة الجديدة');
    }

    // Sync Notes with SQLite Database
    dbNotes.save(updatedNote);

    setIsEditing(false);
    setCurrentEditNote(null);
    triggerAutoSync();
  };

  const handleTogglePin = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotes(prev =>
      prev.map(n => {
        if (n.id === id) {
          const newStatus = !n.isPinned;
          showToast(newStatus ? 'تم تثبيت الملاحظة' : 'تم إلغاء التثبيت');
          const updated = { ...n, isPinned: newStatus };
          // Sync with SQLite DB
          dbNotes.save(updated);
          if (viewingNote?.id === id) {
            setViewingNote(v => v ? { ...v, isPinned: newStatus } : null);
          }
          return updated;
        }
        return n;
      })
    );
    triggerAutoSync();
  };

  const handleToggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotes(prev =>
      prev.map(n => {
        if (n.id === id) {
          const newStatus = !n.isFavorite;
          showToast(newStatus ? 'تمت الإضافة للمفضلة' : 'تمت الإزالة من المفضلة');
          const updated = { ...n, isFavorite: newStatus };
          // Sync with SQLite DB
          dbNotes.save(updated);
          if (viewingNote?.id === id) {
            setViewingNote(v => v ? { ...v, isFavorite: newStatus } : null);
          }
          return updated;
        }
        return n;
      })
    );
    triggerAutoSync();
  };

  const handleToggleArchive = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotes(prev =>
      prev.map(n => {
        if (n.id === id) {
          const newStatus = !n.isArchived;
          showToast(newStatus ? 'تمت أرشفة الملاحظة' : 'تمت الاستعادة من الأرشيف');
          const updated = { ...n, isArchived: newStatus, isPinned: false };
          // Sync with SQLite DB
          dbNotes.save(updated);
          if (viewingNote?.id === id) {
            setViewingNote(v => v ? { ...v, isArchived: newStatus, isPinned: false } : null);
          }
          return updated;
        }
        return n;
      })
    );
    triggerAutoSync();
  };

  // Move note to trash (soft delete)
  const handleDeleteNote = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotes(prev => prev.map(n => {
      if (n.id === id) {
        const updated = { 
          ...n, 
          isTrash: true, 
          isPinned: false, 
          isArchived: false,
          deletedAt: new Date().toISOString() 
        };
        // Sync with SQLite DB
        dbNotes.save(updated);
        return updated;
      }
      return n;
    }));
    showToast('تم نقل الملاحظة إلى سلة المهملات');
    if (viewingNote?.id === id) {
      setViewingNote(null);
    }
    triggerAutoSync();
  };

  // Permanent delete (for trash items)
  const handlePermanentDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotes(prev => prev.filter(n => n.id !== id));
    // Sync with SQLite DB
    dbNotes.delete(id);
    showToast('تم حذف الملاحظة نهائياً');
    if (viewingNote?.id === id) {
      setViewingNote(null);
    }
    triggerAutoSync();
  };

  // Restore from trash
  const handleRestoreFromTrash = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotes(prev => prev.map(n => {
      if (n.id === id) {
        const updated = { 
          ...n, 
          isTrash: false, 
          deletedAt: undefined,
          updatedAt: new Date().toISOString()
        };
        // Sync with SQLite DB
        dbNotes.save(updated);
        return updated;
      }
      return n;
    }));
    showToast('تم استعادة الملاحظة من سلة المهملات');
    if (viewingNote?.id === id) {
      setViewingNote(null);
    }
    triggerAutoSync();
  };

  // Empty trash completely
  const handleEmptyTrash = () => {
    const trashedNotes = notes.filter(n => n.isTrash);
    if (trashedNotes.length === 0) {
      showToast('سلة المهملات فارغة بالفعل');
      return;
    }
    // حذف من SQLite أيضاً
    trashedNotes.forEach(n => dbNotes.delete(n.id));
    setNotes(prev => prev.filter(n => !n.isTrash));
    showToast(`تم تفريغ سلة المهملات (${trashedNotes.length} ملاحظة محذوفة نهائياً)`);
  };

  // Auto-delete trashed notes after 30 days
    useEffect(() => {
    const cleanupTrashedNotes = () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // استخدام دالة updater بدلاً من الاعتماد على state الخارجي
      setNotes(prev => {
        const toDelete = prev.filter(n => 
          n.isTrash && n.deletedAt && new Date(n.deletedAt) < thirtyDaysAgo
        );
        if (toDelete.length > 0) {
          // حذف من SQLite أيضاً
          toDelete.forEach(n => dbNotes.delete(n.id));
          showToast(`تم حذف ${toDelete.length} ملاحظة قديمة من سلة المهملات تلقائياً`);
          return prev.filter(n => 
            !(n.isTrash && n.deletedAt && new Date(n.deletedAt) < thirtyDaysAgo)
          );
        }
        return prev;
      });
    };

    cleanupTrashedNotes();
    const interval = setInterval(cleanupTrashedNotes, 24 * 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []); // مصفوفة تبعيات فارغة — يعمل مرة واحدة فقط عند التركيب

  const handleToggleChecklistItem = (noteId: string, itemId: string) => {
    setNotes(prev =>
      prev.map(n => {
        if (n.id === noteId && n.checklist) {
          const updatedChecklist = n.checklist.map(item =>
            item.id === itemId ? { ...item, completed: !item.completed } : item
          );
          const updatedNote = { ...n, checklist: updatedChecklist, updatedAt: new Date().toISOString() };
          // Sync with SQLite DB
          dbNotes.save(updatedNote);
          if (viewingNote?.id === noteId) {
            setViewingNote(updatedNote);
          }
          return updatedNote;
        }
        return n;
      })
    );
    triggerAutoSync();
  };

  const handleResetData = () => {
    dbNotes.replaceAll(INITIAL_NOTES);
    setNotes(INITIAL_NOTES);
    showToast('تمت استعادة الملاحظات التوضيحية');
  };

  const handleClearAll = () => {
    dbNotes.clearAll();
    setNotes([]);
    showToast('تم مسح جميع الملاحظات');
  };

  // Mass Archive Actions
  const handleArchiveCompletedChecklists = () => {
    let archivedCount = 0;
    setNotes(prev => prev.map(n => {
      if (!n.isArchived && n.checklist && n.checklist.length > 0 && n.checklist.every(c => c.completed)) {
        archivedCount++;
        const updated = { ...n, isArchived: true, isPinned: false };
        dbNotes.save(updated);
        return updated;
      }
      return n;
    }));
    if (archivedCount > 0) {
      showToast(`تمت أرشفة ${archivedCount} ملاحظة مكتملة المهام`);
    } else {
      showToast('لا توجد ملاحظات مكتملة المهام لأرشفتها');
    }
  };

  const handleArchiveOldNotes = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let archivedCount = 0;

    setNotes(prev => prev.map(n => {
      if (!n.isArchived && !n.isPinned && new Date(n.updatedAt) < thirtyDaysAgo) {
        archivedCount++;
        const updated = { ...n, isArchived: true, isPinned: false };
        dbNotes.save(updated);
        return updated;
      }
      return n;
    }));

    if (archivedCount > 0) {
      showToast(`تمت أرشفة ${archivedCount} ملاحظة قديمة (أقدم من 30 يوماً)`);
    } else {
      showToast('لا توجد ملاحظات قديمة غير مؤرشفة');
    }
  };

  const handleRestoreAllArchived = () => {
    let restoredCount = 0;
    setNotes(prev => prev.map(n => {
      if (n.isArchived) {
        restoredCount++;
        const updated = { ...n, isArchived: false };
        dbNotes.save(updated);
        return updated;
      }
      return n;
    }));
    if (restoredCount > 0) {
      showToast(`تمت استعادة ${restoredCount} ملاحظة من الأرشيف`);
    } else {
      showToast('الأرشيف فارغ بالفعل');
    }
  };

  const handleDeleteAllArchived = () => {
    const archivedNotes = notes.filter(n => n.isArchived);
    if (archivedNotes.length === 0) {
      showToast('الأرشيف فارغ بالفعل');
      return;
    }
    setNotes(prev => prev.filter(n => !n.isArchived));
    // حذف من SQLite أيضاً
    archivedNotes.forEach(n => dbNotes.delete(n.id));
    showToast(`تم حذف ${archivedNotes.length} ملاحظة من الأرشيف نهائياً`);
  };

  // Lock/Unlock functions
  const handleToggleNoteLock = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    const note = notes.find(n => n.id === id);
    if (!note) return;

    if (note.isLocked) {
      // Unlock the note - require PIN
      if (!lockHelpers.hasPin()) {
        showToast('⚠️ يرجى تعيين رقم سري أولاً من الإعدادات');
        return;
      }
      setNoteToUnlock(note);
      setPinLockMode('unlock');
    } else {
      // Lock the note - require PIN verification
      if (!lockHelpers.hasPin()) {
        showToast('⚠️ يرجى تعيين رقم سري أولاً من الإعدادات');
        return;
      }
      setNoteToUnlock(note);
      setPinLockMode('verify');
    }
  };

  const handleLockNoteAfterVerification = () => {
    if (noteToUnlock) {
      lockHelpers.toggleNoteLock(noteToUnlock.id, true);
      setNotes(prev => prev.map(n => n.id === noteToUnlock.id ? { ...n, isLocked: true } : n));
      showToast('🔒 تم قفل الملاحظة بنجاح');
      setNoteToUnlock(null);
    }
    setPinLockMode(null);
  };

  // Lock ALL notes
  const handleLockAllNotes = () => {
    if (!lockHelpers.hasPin()) {
      showToast('⚠️ يرجى تعيين رقم سري أولاً من الإعدادات');
      return;
    }
    const lockableNotes = notes.filter(n => !n.isTrash && !n.isLocked);
    if (lockableNotes.length === 0) {
      showToast('جميع الملاحظات مقفلة بالفعل');
      return;
    }
    setPinLockMode('lock_all');
  };

  // Unlock ALL notes
  const handleUnlockAllNotes = () => {
    if (!lockHelpers.hasPin()) {
      showToast('⚠️ يرجى تعيين رقم سري أولاً من الإعدادات');
      return;
    }
    const lockedNotes = notes.filter(n => n.isLocked);
    if (lockedNotes.length === 0) {
      showToast('لا توجد ملاحظات مقفلة');
      return;
    }
    setPinLockMode('unlock_all');
  };

  // Handle selecting a locked note
  const handleSelectLockedNote = (note: Note) => {
    if (note.isLocked) {
      if (!lockHelpers.hasPin()) {
        showToast('⚠️ يرجى تعيين رقم سري أولاً من الإعدادات');
        return;
      }
      setNoteToUnlock(note);
      setPinLockMode('unlock');
    } else {
      setViewingNote(note);
    }
  };

  // After successful PIN unlock - show the note or lock it
  
    const handlePinSuccess = () => {
    // تحديث حالة قفل التطبيق عند نجاح التحقق
    if (pinLockMode === 'verify' && !noteToUnlock) {
      setAppLocked(false);
    }
    if (pinLockMode === 'unlock' && noteToUnlock) {
      setViewingNote(noteToUnlock);
      setNoteToUnlock(null);
    } else if (pinLockMode === 'verify' && noteToUnlock) {
      handleLockNoteAfterVerification();
      return;
    } else if (pinLockMode === 'lock_all') {
      // Lock all lockable notes
      const lockableIds = notes.filter(n => !n.isTrash).map(n => n.id);
      lockHelpers.lockAllNotes(lockableIds);
      setNotes(prev => prev.map(n => !n.isTrash ? { ...n, isLocked: true } : n));
      showToast(`🔒 تم قفل جميع الملاحظات (${lockableIds.length})`);
    } else if (pinLockMode === 'unlock_all') {
      // Unlock all notes
      lockHelpers.unlockAllNotes();
      setNotes(prev => prev.map(n => ({ ...n, isLocked: false })));
      showToast('🔓 تم فتح جميع الملاحظات المقفلة');
    } else if (pinLockMode === 'set') {
      showToast('✅ تم تعيين الرقم السري بنجاح');
    }
    setPinLockMode(null);
  };

  const handlePinCancel = () => {
    setPinLockMode(null);
    setNoteToUnlock(null);
  };

  // ─── Share & Duplicate handlers ───
  const handleShareNote = (note: Note) => {
    if (note.isLocked) { showToast('⚠️ لا يمكن مشاركة ملاحظة مقفلة'); return; }
    const { title, body } = formatNoteForShare(note);
    shareContent(title, body, showToast);
  };

  const handleDuplicateNote = (note: Note) => {
    if (note.isLocked) { showToast('⚠️ لا يمكن نسخ ملاحظة مقفلة'); return; }
    const dup = duplicateNote(note);
    dbNotes.save(dup);
    setNotes(prev => [dup, ...prev]);
    showToast('✅ تم إنشاء نسخة جديدة من الملاحظة');
  };

  const handleShareTask = (task: AppTask) => {
    const { title, body } = formatTaskForShare(task);
    shareContent(title, body, showToast);
  };

  const handleDuplicateTask = (task: AppTask) => {
    const dup = duplicateTask(task);
    dbTasks.save(dup);
    setTasks(prev => [dup, ...prev]);
    showToast('✅ تم إنشاء نسخة جديدة من المهمة');
  };

  const handleShareEvent = (ev: AppEvent) => {
    const { title, body } = formatEventForShare(ev);
    shareContent(title, body, showToast);
  };

  const handleDuplicateEvent = (ev: AppEvent) => {
    const dup = duplicateEvent(ev);
    dbEvents.save(dup);
    setEvents(prev => [dup, ...prev]);
    showToast('✅ تم إنشاء نسخة جديدة من الحدث');
  };

  const handleShareShoppingList = (list: ShoppingList) => {
    const { title, body } = formatShoppingListForShare(list);
    shareContent(title, body, showToast);
  };

  const handleDuplicateShoppingList = (listId: string) => {
    const list = shoppingLists.find(l => l.id === listId);
    if (!list) return;
    const dup = duplicateShoppingList(list);
    dbShopping.save(dup);
    setShoppingLists(prev => [dup, ...prev]);
    showToast('✅ تم إنشاء نسخة جديدة من القائمة');
  };

  // ─── Export Data (Backup) ───
  const handleExportData = () => {
    try {
      const backupData = {
        version: 'notes_app_backup_v1',
        exportedAt: new Date().toISOString(),
        notes: notes,
        events: events,
        tasks: tasks,
        shoppingLists: shoppingLists,
        settings: settings,
        // ✅ لا نصدّر تجزئة PIN لأسباب أمنية — المستخدم يجب أن يعيد تعيينه بعد الاستيراد
        appLockEnabled: localStorage.getItem('notes_app_lock_enabled_v1') === 'true',
        lockedNotes: localStorage.getItem('notes_app_locked_ids_v1') || '[]',
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
      const tempLink = document.createElement('a');
      tempLink.href = url;
      tempLink.download = `mohafadaty_backup_${dateStr}.json`;
      
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(url);
      
      showToast('✅ تم تصدير النسخة الاحتياطية بنجاح');
    } catch (error) {
      if (import.meta.env.DEV) console.error('Export failed', error);
      showToast('❌ فشل تصدير البيانات');
    }
  };

  // ─── Validate Import Data ───
    const validateImportData = (data: unknown): boolean => {
    if (!data || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    
    // تحقق من البنية الأساسية
    if (d.notes !== undefined && !Array.isArray(d.notes)) return false;
    if (d.tasks !== undefined && !Array.isArray(d.tasks)) return false;
    if (d.events !== undefined && !Array.isArray(d.events)) return false;
    if (d.shoppingLists !== undefined && !Array.isArray(d.shoppingLists)) return false;
    
    // تحقق من الحقول المطلوبة في كل ملاحظة
    if (Array.isArray(d.notes)) {
      for (const note of d.notes) {
        if (!note || typeof note !== 'object') return false;
        if (typeof (note as any).id !== 'string') return false;
        if (typeof (note as any).title !== 'string') return false;
      }
    }
    
    // حد أقصى لعدد العناصر لمنع هجمات الذاكرة
    const totalItems = (Array.isArray(d.notes) ? d.notes.length : 0)
      + (Array.isArray(d.events) ? d.events.length : 0)
      + (Array.isArray(d.tasks) ? d.tasks.length : 0)
      + (Array.isArray(d.shoppingLists) ? d.shoppingLists.length : 0);
    if (totalItems > 50000) return false;
    
    // حد أقصى معقول للحجم
    const jsonSize = JSON.stringify(data).length;
    if (jsonSize > 10 * 1024 * 1024) return false;
    
    return true;
  };

  // ─── Import Data (Restore) ───
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ✅ تحقق من نوع الملف
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      showToast('❌ يجب أن يكون الملف بصيغة JSON');
      return;
    }
    // ✅ تحقق من حجم الملف
    if (file.size > 10 * 1024 * 1024) {
      showToast('❌ الملف كبير جداً (الحد الأقصى 10MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        
        // ✅ تحقق من البنية
        if (!validateImportData(imported)) {
          showToast('❌ بنية الملف غير صحيحة');
          return;
        }
        
        // Validation
        if (imported.version !== 'notes_app_backup_v1') {
          showToast('❌ ملف نسخة احتياطية غير صالح أو غير متوافق');
          return;
        }

        // 1. Notes — حفظ في SQLite
        if (Array.isArray(imported.notes)) {
          dbNotes.replaceAll(imported.notes);
          setNotes(imported.notes);
        }
        
        // 2. Events — حفظ في SQLite
        if (Array.isArray(imported.events)) {
          dbEvents.replaceAll(imported.events);
          setEvents(imported.events);
        }

        // 3. Tasks — حفظ في SQLite
        if (Array.isArray(imported.tasks)) {
          dbTasks.replaceAll(imported.tasks);
          setTasks(imported.tasks);
        }

        // 4. Shopping Lists — حفظ في SQLite
        if (Array.isArray(imported.shoppingLists)) {
          dbShopping.replaceAll(imported.shoppingLists);
          setShoppingLists(imported.shoppingLists);
        }

        // 5. Settings
                // 5. Settings — تحقق من البنية قبل التطبيق
        if (imported.settings && typeof imported.settings === 'object') {
          const safeSettings: AppSettings = {
            syncOnLaunch: typeof imported.settings.syncOnLaunch === 'boolean' ? imported.settings.syncOnLaunch : true,
            defaultScreen: ['notes', 'tasks', 'shopping', 'calendar', 'settings'].includes(imported.settings.defaultScreen) ? imported.settings.defaultScreen : 'notes',
            defaultColor: ['amber', 'emerald', 'sky', 'rose', 'purple', 'slate'].includes(imported.settings.defaultColor) ? imported.settings.defaultColor : 'amber',
            defaultFontType: ['cairo', 'monospace', 'sans-serif', 'serif'].includes(imported.settings.defaultFontType) ? imported.settings.defaultFontType : 'cairo',
            defaultFontSize: ['sm', 'base', 'lg', 'xl'].includes(imported.settings.defaultFontSize) ? imported.settings.defaultFontSize : 'base',
            listItemHeight: ['normal', 'small', 'tiny'].includes(imported.settings.listItemHeight) ? imported.settings.listItemHeight : 'normal',
            defaultSortOrder: ['updatedAt', 'createdAt', 'color', 'title', 'reminder', 'last-used'].includes(imported.settings.defaultSortOrder) ? imported.settings.defaultSortOrder : 'updatedAt',
          };
          setSettings(safeSettings);
        }

        // 6. ✅ أمني: لا نستورد PIN من ملفات خارجية أبداً — يمكن أن يكون ضاراً
        // المستخدم يجب أن يعيد تعيين الرقم السري يدوياً بعد الاستيراد
        if (imported.pin || imported.appLockEnabled) {
          showToast('⚠️ يجب إعادة تعيين الرقم السري من الإعدادات بعد الاستيراد');
        }
        // تأكد من أن قفل التطبيق معطل بعد الاستيراد حتى يعيد المستخدم تعيين PIN
        localStorage.setItem('notes_app_lock_enabled_v1', 'false');
        setAppLocked(false);

        // ✅ تحقق من أن lockedNotes مصفوفة سليمة من strings
                // ✅ أمني: لا نستورد lockedNotes من ملفات خارجية — يمكن استخدامه لحجب الوصول
        // المستخدم يجب أن يعيد قفل الملاحظات يدوياً بعد الاستيراد
        // مسح أي قفل حالي لضمان الوصول
        localStorage.removeItem('notes_app_locked_ids_v1');

        showToast('✅ تم استيراد وتحديث البيانات بالكامل بنجاح!');
      } catch (err) {
        if (import.meta.env.DEV) console.error('Import failed', err);
        showToast('❌ فشل قراءة ملف الاستيراد');
      }
    };
    reader.readAsText(file);
  };

  const openNewNoteEditor = () => {
    setCurrentEditNote(null);
    setIsEditing(true);
  };

  const openEditNoteEditor = (note: Note) => {
    setCurrentEditNote(note);
    setIsEditing(true);
  };

  const handleSearchResults = useCallback((results: Note[], filters: SearchFilters) => {
    setSearchResults(results);
    setSearchFilters(filters);
    setSearchQuery(filters.query);
  }, []);

  const getFilteredNotes = (): Note[] => {
    if (searchResults !== null && (searchQuery || searchFilters.categories.length > 0 || searchFilters.colors.length > 0)) {
      return searchResults;
    }

    const filtered = notes.filter(n => {
      // Trash tab logic
      if (activeTab === 'trash') {
        return n.isTrash;
      }
      
      // For other tabs, exclude trashed notes
      if (n.isTrash) return false;
      
      if (activeTab === 'favorites' && !n.isFavorite) return false;
      if (activeTab === 'archive' && !n.isArchived) return false;
      if (activeTab !== 'archive' && n.isArchived) return false;
      if (selectedCategory !== 'all' && n.category !== selectedCategory) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = n.title.toLowerCase().includes(q);
        const matchContent = n.content.toLowerCase().includes(q);
        const matchChecklist = n.checklist?.some(c => c.text.toLowerCase().includes(q)) || false;
        return matchTitle || matchContent || matchChecklist;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      // Pin always takes priority unless we're in specific sorting modes
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      let comparison = 0;
      const { sortOrder } = searchFilters;
      let activeSortBy = searchFilters.sortBy;
      
      if (settings.defaultSortOrder !== 'last-used' && searchFilters.sortBy === 'updatedAt' && searchFilters.sortOrder === 'desc') {
        activeSortBy = settings.defaultSortOrder as any;
      }

      switch (activeSortBy) {
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title, 'ar');
          break;
        case 'color':
          comparison = a.color.localeCompare(b.color);
          break;
        case 'reminder':
          const timeA = a.reminder?.datetime ? new Date(a.reminder.datetime).getTime() : 0;
          const timeB = b.reminder?.datetime ? new Date(b.reminder.datetime).getTime() : 0;
          comparison = timeA - timeB;
          break;
        default:
          comparison = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const sortedNotes = getFilteredNotes();
  const categoriesList = ['all', 'work', 'personal', 'ideas', 'study'];
  const hasActiveSearch = searchQuery.trim() || searchResults !== null;

  const upcomingMainReminders = notes
    .filter(n => !n.isTrash && !n.isArchived && n.reminder?.datetime)
    .sort((a, b) => new Date(a.reminder!.datetime).getTime() - new Date(b.reminder!.datetime).getTime())
    .slice(0, 3);

  const upcomingTaskReminders = notes
    .filter(n => !n.isTrash && !n.isArchived && n.checklist?.some(item => item.reminderAt))
    .flatMap(n =>
      (n.checklist || [])
        .filter(item => item.reminderAt)
        .map(item => ({ noteId: n.id, noteTitle: n.title, itemText: item.text, reminderAt: item.reminderAt! }))
    )
    .sort((a, b) => new Date(a.reminderAt).getTime() - new Date(b.reminderAt).getTime())
    .slice(0, 2);

  // Show loading screen while SQLite WASM initializes
  if (!dbReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-['Cairo'] antialiased flex items-center justify-center">
        <div className="text-center space-y-3 animate-pulse">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center mx-auto shadow-lg">
            <span className="text-2xl">📝</span>
          </div>
          <h2 className="text-sm font-bold text-white">جارِ تهيئة قاعدة البيانات...</h2>
          <p className="text-[11px] text-slate-400">SQLite WASM · تخزين محلي آمن</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-['Cairo'] antialiased">
      <div className="w-full h-full min-h-screen bg-slate-900 flex flex-col relative overflow-hidden">
        
        <MobileHeader
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            if (!q) setSearchResults(null);
          }}
          activeCount={notes.filter(n => !n.isArchived).length}
          onOpenAdvancedSearch={() => setIsAdvancedSearchOpen(true)}
        />

        <div className="flex-1 overflow-y-auto flex flex-col relative">
          
          {activeTab === 'settings' ? (
            <StatsView
              notes={notes}
              onResetData={handleResetData}
              onClearAll={handleClearAll}
              showToast={showToast}
              onOpenPinSetup={() => setPinLockMode('set')}
              onClearPin={() => {
                lockHelpers.clearPin();
                setAppLocked(false);
                showToast('تم إزالة الرقم السري وحماية التطبيق');
              }}
              onToggleAppLock={(enabled) => {
                lockHelpers.setAppLock(enabled);
                setAppLocked(enabled);
                showToast(enabled ? 'تم تفعيل قفل التطبيق' : 'تم إيقاف قفل التطبيق');
              }}
              hasPin={lockHelpers.hasPin()}
              appLockEnabled={appLocked}
              themeMode={themeMode}
              onChangeThemeMode={(newTheme: ThemeMode) => {
                setThemeMode(newTheme);
                showToast(`تم تغيير المظهر إلى: ${newTheme === 'light' ? 'الفاتح' : newTheme === 'dark' ? 'الداكن' : 'تلقائي (حسب النظام)'}`);
              }}
              settings={settings}
              onUpdateSettings={(newSet) => {
                setSettings(prev => ({ ...prev, ...newSet }));
              }}
              onExportData={handleExportData}
              onImportData={handleImportData}
            />
          ) : activeTab === 'calendar' ? (
            <div className="max-w-4xl mx-auto w-full pb-20">
              <CalendarView
                notes={notes}
                events={events}
                tasks={tasks}
                onSelectNote={(n) => setViewingNote(n)}
                onSelectEvent={(ev) => setViewingEvent(ev)}
                onSelectTask={(t) => {
                  setCurrentEditTask(t);
                  setIsTaskEditorOpen(true);
                }}
                onNewEvent={(date) => {
                  setNewEventDate(date);
                  setCurrentEditEvent(null);
                  setIsEventEditorOpen(true);
                }}
              />
            </div>
          ) : activeTab === 'tasks' ? (
            <div className="max-w-4xl mx-auto w-full">
              <TaskView
                tasks={tasks}
                onEditTask={(t) => {
                  setCurrentEditTask(t);
                  setIsTaskEditorOpen(true);
                }}
                onToggleComplete={handleToggleTaskComplete}
                onDeleteTask={handleDeleteTask}
                onShareTask={handleShareTask}
                onDuplicateTask={handleDuplicateTask}
              />
            </div>
          ) : activeTab === 'shopping' ? (
            <div className="max-w-4xl mx-auto w-full h-full">
              <ShoppingView
                lists={shoppingLists}
                onSaveLists={handleSaveShoppingLists}
                showToast={showToast}
                onShareList={handleShareShoppingList}
                onDuplicateList={handleDuplicateShoppingList}
              />
            </div>
          ) : (
            <div className="p-4 pt-1 space-y-4 pb-24 max-w-4xl mx-auto w-full">
              
              {activeTab === 'notes' && !hasActiveSearch && (
                <div className="flex items-center justify-between gap-1 pb-1 overflow-x-auto select-none no-scrollbar">
                  <div className="flex items-center gap-1.5 shrink-0">
                    {categoriesList.map(cat => {
                      const isActive = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                            isActive
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-500/10'
                              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {CATEGORY_LABELS[cat] || 'الكل'}
                        </button>
                      );
                    })}
                  </div>

                  {/* View modes switcher */}
                  <div className="flex items-center gap-0.5 bg-slate-800/80 p-1 rounded-xl shrink-0 mr-2 border border-slate-700">
                    {[
                      { mode: 'list', icon: List, label: 'قائمة بسيطة' },
                      { mode: 'details', icon: AlignLeft, label: 'تفاصيل موسعة' },
                      { mode: 'grid', icon: LayoutGrid, label: 'شبكة قياسية' },
                      { mode: 'large_grid', icon: Layout, label: 'شبكة كبيرة' },
                    ].map(item => {
                      const Icon = item.icon;
                      const isActive = viewMode === item.mode;
                      return (
                        <button
                          key={item.mode}
                          onClick={() => {
                            setViewMode(item.mode as ViewMode);
                            showToast(`تم التبديل لعرض: ${item.label}`);
                          }}
                          className={`p-1.5 rounded-lg transition-all ${
                            isActive ? 'bg-amber-500 text-slate-950 shadow-md scale-105 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-750'
                          }`}
                          title={item.label}
                        >
                          <Icon size={14} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mass Archiving Tools for Active Feed */}
              {activeTab === 'notes' && !hasActiveSearch && notes.filter(n => !n.isArchived).length > 0 && (
                <div className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Archive size={14} className="text-amber-400" />
                    <span>أدوات الأرشفة الذكية:</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={handleArchiveCompletedChecklists}
                      className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 px-2.5 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1 transition-colors"
                      title="أرشفة كل الملاحظات التي تم إنجاز كافة مهامها"
                    >
                      <CheckSquare size={12} />
                      <span>أرشفة المكتمل</span>
                    </button>
                    <button
                      onClick={handleArchiveOldNotes}
                      className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 px-2.5 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1 transition-colors"
                      title="أرشفة الملاحظات غير المثبتة وأقدم من 30 يوماً"
                    >
                      <Archive size={12} />
                      <span>أرشفة القديم (+30 يوم)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Upcoming reminders */}
              {activeTab === 'notes' && !hasActiveSearch && (upcomingMainReminders.length > 0 || upcomingTaskReminders.length > 0) && (
                <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sky-300 text-xs font-bold">
                      <Bell size={14} />
                      <span>التذكيرات القادمة</span>
                    </div>
                    <span className="text-[10px] bg-sky-500/10 text-sky-300 px-2 py-0.5 rounded-full border border-sky-500/20">
                      {upcomingMainReminders.length + upcomingTaskReminders.length} قريباً
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {upcomingMainReminders.map(reminderNote => (
                      <button
                        key={reminderNote.id}
                        onClick={() => setViewingNote(reminderNote)}
                        className="w-full text-right bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/60 rounded-xl px-3 py-2 text-xs transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-sky-300 shrink-0">
                            {reminderNote.reminder?.type === 'event' ? <CalendarClock size={12} /> : <Bell size={12} />}
                            <span className="text-[10px]">{reminderNote.reminder?.type === 'event' ? 'حدث' : 'ملاحظة'}</span>
                          </div>
                          <span className="text-slate-200 truncate flex-1 font-medium">{reminderNote.title}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(reminderNote.reminder!.datetime).toLocaleString('ar-EG', {
                            weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                          })}
                        </p>
                      </button>
                    ))}

                    {upcomingTaskReminders.map((task, idx) => (
                      <button
                        key={`${task.noteId}-${idx}`}
                        onClick={() => {
                          const note = notes.find(n => n.id === task.noteId);
                          if (note) setViewingNote(note);
                        }}
                        className="w-full text-right bg-slate-900/40 hover:bg-slate-900/60 border border-slate-800/60 rounded-xl px-3 py-2 text-xs transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-purple-300 shrink-0">
                            <ListTodo size={12} />
                            <span className="text-[10px]">مهمة</span>
                          </div>
                          <span className="text-slate-200 truncate flex-1 font-medium">{task.itemText}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 truncate">داخل: {task.noteTitle}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(task.reminderAt).toLocaleString('ar-EG', {
                            weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                          })}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lock All / Unlock All Tools */}
              {activeTab === 'notes' && !hasActiveSearch && lockHelpers.hasPin() && notes.filter(n => !n.isTrash && !n.isArchived).length > 0 && (
                <div className="bg-sky-950/30 border border-sky-900/40 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-sky-300">
                    <LockIcon size={14} className="text-sky-400" />
                    <span>أدوات القفل والحماية:</span>
                    <span className="text-[10px] bg-sky-900/40 text-sky-300 px-2 py-0.5 rounded-full">
                      {notes.filter(n => n.isLocked).length} مقفلة
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={handleLockAllNotes}
                      className="text-[11px] bg-sky-900/30 hover:bg-sky-900/50 text-sky-300 hover:text-sky-200 px-2.5 py-1.5 rounded-xl border border-sky-800/50 flex items-center gap-1 transition-colors"
                      title="قفل جميع الملاحظات بالرقم السري"
                    >
                      <LockIcon size={12} />
                      <span>قفل الكل</span>
                    </button>
                    <button
                      onClick={handleUnlockAllNotes}
                      className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 px-2.5 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1 transition-colors"
                      title="فتح جميع الملاحظات المقفلة"
                    >
                      <UnlockIcon size={12} />
                      <span>فتح الكل</span>
                    </button>
                  </div>
                </div>
              )}

              {hasActiveSearch && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs px-3 py-2 rounded-xl flex items-center justify-between">
                  <span>🔍 نتائج البحث: {sortedNotes.length} ملاحظة</span>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults(null);
                      setSearchFilters(defaultFilters);
                    }}
                    className="text-amber-400 hover:text-white text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full"
                  >
                    مسح البحث
                  </button>
                </div>
              )}

              {activeTab === 'favorites' && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs px-3 py-2 rounded-xl flex items-center justify-between">
                  <span>⭐ الملاحظات المفضلة فقط</span>
                  <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                    {sortedNotes.length}
                  </span>
                </div>
              )}

              {/* Advanced Archive Management Header */}
              {activeTab === 'archive' && (
                <div className="space-y-2">
                  <div className="bg-slate-800 border border-slate-700 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-200 font-bold">
                      <Archive size={16} className="text-amber-400" />
                      <span>صندوق الأرشيف</span>
                      <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded-full font-normal">
                        {sortedNotes.length} محفوظ
                      </span>
                    </div>

                    {sortedNotes.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleRestoreAllArchived}
                          className="text-[11px] bg-slate-700 hover:bg-slate-600 text-sky-300 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors font-medium"
                          title="استعادة كافة الملاحظات إلى الشاشة الرئيسية"
                        >
                          <RefreshCw size={12} />
                          <span>استعادة الكل</span>
                        </button>
                        <button
                          onClick={handleDeleteAllArchived}
                          className="text-[11px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors font-medium"
                          title="حذف كل الأرشيف نهائياً"
                        >
                          <Trash2 size={12} />
                          <span>تفريغ الأرشيف</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 px-1">
                    الملاحظات المؤرشفة تظل محفوظة بأمان ولا تظهر في التغذية الرئيسية. يمكنك استعادتها للتعديل في أي وقت.
                  </p>
                </div>
              )}

              {/* Trash Management Header */}
              {activeTab === 'trash' && (
                <div className="space-y-2">
                  <div className="bg-rose-950/30 border border-rose-900/50 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-rose-200 font-bold">
                      <Trash2 size={16} className="text-rose-400" />
                      <span>سلة المهملات</span>
                      <span className="text-[10px] bg-rose-900/50 text-rose-300 px-2 py-0.5 rounded-full font-normal">
                        {sortedNotes.length} محذوف
                      </span>
                    </div>

                    {sortedNotes.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            notes.filter(n => n.isTrash).forEach(n => handleRestoreFromTrash(n.id));
                          }}
                          className="text-[11px] bg-sky-900/30 hover:bg-sky-900/50 text-sky-300 border border-sky-800/50 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors font-medium"
                          title="استعادة كافة الملاحظات من سلة المهملات"
                        >
                          <RefreshCw size={12} />
                          <span>استعادة الكل</span>
                        </button>
                        <button
                          onClick={handleEmptyTrash}
                          className="text-[11px] bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors font-medium"
                          title="حذف جميع الملاحظات نهائياً من السلة"
                        >
                          <Trash2 size={12} />
                          <span>تفريغ السلة</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-rose-400/70 px-1">
                    ⚠️ الملاحظات في سلة المهملات يتم حذفها تلقائياً بعد 30 يوماً. استعدها الآن إذا كنت بحاجة إليها.
                  </p>
                </div>
              )}

              {sortedNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16 px-4 my-auto">
                  <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-600 mb-3">
                    {activeTab === 'archive' ? <Archive size={28} /> : <Plus size={28} />}
                  </div>
                  <h3 className="text-sm font-bold text-slate-300 mb-1">
                    {activeTab === 'archive' ? 'صندوق الأرشيف فارغ' : 'لا توجد ملاحظات مطابقة'}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                    {hasActiveSearch
                      ? 'لم نعثر على أي ملاحظة مطابقة لمعايير البحث. جرّب البحث المتقدم لتعزيز النتائج.'
                      : activeTab === 'favorites'
                      ? 'قائمة المفضلة فارغة. اضغط على ⭐ في أي ملاحظة لإضافتها.'
                      : activeTab === 'archive'
                      ? 'لا توجد أي ملاحظات مؤرشفة حالياً. يمكنك أرشفة الملاحظات القديمة أو المكتملة لتنظيف شاشتك الرئيسية.'
                      : activeTab === 'trash'
                      ? 'سلة المهملات فارغة. الملاحظات المحذوفة تظهر هنا لمدة 30 يوماً قبل الحذف النهائي.'
                      : 'اضغط على زر (+) لكتابة أول ملاحظة.'}
                  </p>
                  {hasActiveSearch && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults(null);
                        setSearchFilters(defaultFilters);
                      }}
                      className="mt-3 text-xs bg-slate-800 hover:bg-slate-750 text-amber-400 px-3 py-1.5 rounded-xl font-medium"
                    >
                      إلغاء البحث
                    </button>
                  )}
                </div>
              ) : (
                <div className={`grid gap-3 transition-all ${
                  viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3' :
                  viewMode === 'large_grid' ? 'grid-cols-1 sm:grid-cols-2' :
                  'grid-cols-1'
                }`}>
                  {sortedNotes.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onSelect={(n) => handleSelectLockedNote(n)}
                      onTogglePin={handleTogglePin}
                      onToggleFavorite={handleToggleFavorite}
                      onToggleLock={handleToggleNoteLock}
                      onArchive={handleToggleArchive}
                      onDelete={note.isTrash ? handlePermanentDelete : handleDeleteNote}
                      onRestore={note.isTrash ? handleRestoreFromTrash : undefined}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Enhanced Multi-action Floating Action Button (FAB) */}
          <EnhancedFAB
            activeTab={activeTab}
            onAddNote={openNewNoteEditor}
            onAddTask={() => {
              setCurrentEditTask(null);
              setIsTaskEditorOpen(true);
            }}
            onAddEvent={() => {
              setNewEventDate(undefined);
              setCurrentEditEvent(null);
              setIsEventEditorOpen(true);
            }}
            onAddShoppingList={() => {
              setActiveTab('shopping');
              // Delay slightly to let tab transition complete before opening create overlay
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('openNewShoppingList'));
              }, 150);
            }}
          />
        </div>

        <Toast message={toastMsg} />

        {/* Quick Sort Menu Overlay */}
        {isSortMenuOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" 
            onClick={() => setIsSortMenuOpen(false)}
          >
            <div 
              className="absolute top-16 left-4 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-2 w-48 animate-fadeIn"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-[10px] text-slate-500 font-bold px-3 py-1 mb-1 border-b border-slate-700/50">ترتيب الملاحظات حسب:</h3>
              {[
                { id: 'updatedAt', label: 'تاريخ التعديل' },
                { id: 'createdAt', label: 'تاريخ الإنشاء' },
                { id: 'title', label: 'أبجدياً (العنوان)' },
                { id: 'color', label: 'اللون' },
                { id: 'reminder', label: 'وقت التذكير' }
              ].map(option => (
                <button
                  key={option.id}
                  onClick={() => {
                    setSearchFilters(prev => ({ 
                      ...prev, 
                      sortBy: option.id as SearchFilters['sortBy'],
                      sortOrder: prev.sortBy === option.id ? (prev.sortOrder === 'asc' ? 'desc' : 'asc') : 'desc'
                    }));
                    setIsSortMenuOpen(false);
                    showToast(`تم الترتيب حسب ${option.label}`);
                  }}
                  className={`w-full text-right px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between ${
                    searchFilters.sortBy === option.id ? 'bg-amber-500/10 text-amber-400 font-bold' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{option.label}</span>
                  {searchFilters.sortBy === option.id && (
                    searchFilters.sortOrder === 'desc' ? <List size={12} className="rotate-180" /> : <List size={12} />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <AdvancedSearch
          notes={notes}
          isOpen={isAdvancedSearchOpen}
          onClose={() => setIsAdvancedSearchOpen(false)}
          onResultsChange={handleSearchResults}
          initialFilters={searchFilters}
        />

        {isEditing && (
          <NoteEditor
            note={currentEditNote}
            onSave={handleSaveNote}
            onClose={() => setIsEditing(false)}
            showToast={showToast}
          />
        )}

        {viewingNote && !isEditing && (
          <NoteDetailModal
            note={viewingNote}
            onClose={() => setViewingNote(null)}
            onEdit={() => openEditNoteEditor(viewingNote)}
            onToggleChecklist={(itemId) => handleToggleChecklistItem(viewingNote.id, itemId)}
            onTogglePin={(id) => handleTogglePin(id)}
            onToggleFavorite={(id) => handleToggleFavorite(id)}
            onToggleArchive={(id) => handleToggleArchive(id)}
            onToggleLock={(id) => handleToggleNoteLock(id)}
            onRestoreFromTrash={viewingNote.isTrash ? handleRestoreFromTrash : undefined}
            onPermanentDelete={viewingNote.isTrash ? handlePermanentDelete : undefined}
            onShare={handleShareNote}
            onDuplicate={(n) => { handleDuplicateNote(n); setViewingNote(null); }}
            showToast={showToast}
          />
        )}

        {/* Event Editor */}
        {isEventEditorOpen && (
          <EventEditor
            event={currentEditEvent}
            initialDate={newEventDate}
            onSave={handleSaveEvent}
            onDelete={handleDeleteEvent}
            onClose={() => { setIsEventEditorOpen(false); setCurrentEditEvent(null); setNewEventDate(undefined); }}
            showToast={showToast}
          />
        )}

        {/* Event Detail */}
        {viewingEvent && !isEventEditorOpen && (
          <EventDetailModal
            event={viewingEvent}
            onClose={() => setViewingEvent(null)}
            onEdit={() => { setCurrentEditEvent(viewingEvent); setIsEventEditorOpen(true); }}
            onDelete={handleDeleteEvent}
            onToggleComplete={handleToggleEventComplete}
            onShare={handleShareEvent}
            onDuplicate={(ev) => { handleDuplicateEvent(ev); setViewingEvent(null); }}
            showToast={showToast}
          />
        )}

        {/* Task Editor */}
        {isTaskEditorOpen && (
          <TaskEditor
            task={currentEditTask}
            onSave={handleSaveTask}
            onDelete={handleDeleteTask}
            onClose={() => { setIsTaskEditorOpen(false); setCurrentEditTask(null); }}
            showToast={showToast}
          />
        )}

        {/* Pin Lock Modal */}
        {pinLockMode && (
          <PinLock
            mode={pinLockMode}
            noteTitle={noteToUnlock?.title}
            onSuccess={handlePinSuccess}
            onCancel={handlePinCancel}
            showToast={showToast}
          />
        )}

        <BottomNav
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            if (tab !== 'notes') {
              setSelectedCategory('all');
            }
          }}
          favoritesCount={notes.filter(n => n.isFavorite && !n.isTrash && !n.isArchived).length}
          archiveCount={notes.filter(n => n.isArchived && !n.isTrash).length}
          trashCount={notes.filter(n => n.isTrash).length}
          calendarCount={
            notes.filter(n => !n.isTrash && !n.isArchived).reduce((acc, n) => {
              const main = n.reminder?.datetime ? 1 : 0;
              const checklistTasks = n.checklist?.filter(t => t.reminderAt).length || 0;
              return acc + main + checklistTasks;
            }, 0) + 
            events.length + 
            tasks.filter(t => t.dueDate || t.reminderAt).length
          }
          tasksCount={
            tasks.filter(t => !t.isCompleted).length
          }
          shoppingCount={
            shoppingLists.filter(l => !l.isArchived).reduce(
              (s, l) => s + l.items.filter(i => !i.checked).length, 0
            )
          }
        />
      </div>
    </div>
  );
}
