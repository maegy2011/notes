export type NoteCategory = 'work' | 'personal' | 'ideas' | 'study';

export type NoteColor = 'amber' | 'emerald' | 'sky' | 'rose' | 'purple' | 'slate';

export type ReminderType = 'note' | 'event';

export interface ReminderData {
  type: ReminderType;
  datetime: string;
  endDatetime?: string;
  location?: string;
  note?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  reminderAt?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  color: NoteColor;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  isTrash: boolean;
  isLocked: boolean;
  deletedAt?: string;
  checklist?: ChecklistItem[];
  reminder?: ReminderData;
}

/* ─────────────────────────────────────────────
   Event entity – independent from notes
   ───────────────────────────────────────────── */
export type EventCategory = 'meeting' | 'birthday' | 'holiday' | 'personal' | 'work' | 'other';
export type EventColor = 'amber' | 'emerald' | 'sky' | 'rose' | 'purple' | 'slate';
export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface AppEvent {
  id: string;
  title: string;
  description: string;
  startDatetime: string;
  endDatetime: string;
  allDay: boolean;
  category: EventCategory;
  color: EventColor;
  location: string;
  repeat: RepeatType;
  createdAt: string;
  updatedAt: string;
  isCompleted: boolean;
}

/* ─────────────────────────────────────────────
   Task entity – independent from notes
   ───────────────────────────────────────────── */
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskCategory = 'work' | 'personal' | 'study' | 'shopping' | 'other';
export type TaskColor = 'amber' | 'emerald' | 'sky' | 'rose' | 'purple' | 'slate';

export interface AppTask {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  category: TaskCategory;
  color: TaskColor;
  dueDate?: string;       // ISO date string
  reminderAt?: string;    // ISO date string for notifications
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ─────────────────────────────────────────────
   Shopping List entity
   ───────────────────────────────────────────── */
export type ShopItemUnit = 'piece' | 'kg' | 'g' | 'L' | 'ml' | 'pack' | 'box' | 'bottle' | 'dozen' | 'other';
export type ShopCategory =
  | 'fruits' | 'vegetables' | 'meat' | 'dairy' | 'bakery'
  | 'beverages' | 'frozen' | 'cleaning' | 'personal' | 'electronics'
  | 'clothing' | 'pharmacy' | 'other';

export interface ShopItem {
  id: string;
  name: string;
  qty: number;
  unit: ShopItemUnit;
  price?: number;           // per unit (optional)
  category: ShopCategory;
  note?: string;
  checked: boolean;
  addedAt: string;
}

export type ShopListColor = 'amber' | 'emerald' | 'sky' | 'rose' | 'purple' | 'slate';

export interface ShoppingList {
  id: string;
  name: string;
  color: ShopListColor;
  budget?: number;          // total budget in local currency
  store?: string;           // store name / URL
  items: ShopItem[];
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

export type TabType = 'notes' | 'tasks' | 'shopping' | 'favorites' | 'archive' | 'trash' | 'calendar' | 'settings';

export type ThemeMode = 'system' | 'light' | 'dark';
