import { Note, AppTask, AppEvent, ShoppingList, ChecklistItem } from '../types';
import DOMPurify from 'dompurify';

/* ─────────────────────────────────────────────
   Helpers — strip HTML & format dates
   ───────────────────────────────────────────── */
const stripHtml = (html: string): string => {
  if (!html) return '';
  // ✅ تعقيم أولاً ثم استخراج النص فقط
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
  const tmp = document.createElement('div');
  tmp.textContent = clean; // ✅ textContent لا يُنفذ HTML
  return tmp.textContent || '';
};

const fmtDateTime = (iso?: string): string => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ar-EG', {
    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

// ✅ UID آمن باستخدام Web Crypto API
export const uid = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // ✅ fallback آمن
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
};

/* ─────────────────────────────────────────────
   Format entities to plain text for sharing
   ───────────────────────────────────────────── */

export const formatNoteForShare = (note: Note): { title: string; body: string } => {
  const lines: string[] = [];
  lines.push(`📝 ${note.title || 'بدون عنوان'}`);
  lines.push('═══════════════════');
  if (note.content) lines.push(stripHtml(note.content));

  if (note.reminder?.datetime) {
    lines.push('');
    lines.push(note.reminder.type === 'event' ? `📅 الحدث: ${fmtDateTime(note.reminder.datetime)}` : `🔔 تذكير: ${fmtDateTime(note.reminder.datetime)}`);
    if (note.reminder.endDatetime) lines.push(`⏳ ينتهي: ${fmtDateTime(note.reminder.endDatetime)}`);
    if (note.reminder.location) lines.push(`📍 ${note.reminder.location}`);
    if (note.reminder.note) lines.push(`📌 ${note.reminder.note}`);
  }

  if (note.checklist && note.checklist.length > 0) {
    lines.push('');
    lines.push('☑️ قائمة المهام:');
    note.checklist.forEach((c: ChecklistItem) => {
      const reminder = c.reminderAt ? ` (🔔 ${fmtDateTime(c.reminderAt)})` : '';
      lines.push(`${c.completed ? '✅' : '⬜'} ${c.text}${reminder}`);
    });
  }

  lines.push('');
  lines.push(`— صنع بـ ملاحظاتي · ${new Date(note.updatedAt).toLocaleDateString('ar-EG')}`);
  return { title: note.title || 'ملاحظة', body: lines.join('\n') };
};

export const formatTaskForShare = (task: AppTask): { title: string; body: string } => {
  const priorityLabel = task.priority === 'high' ? '🔴 عالية' : task.priority === 'medium' ? '🟡 متوسطة' : '🟢 منخفضة';
  const lines: string[] = [
    `${task.isCompleted ? '✅' : '☑️'} ${task.title}`,
    '═══════════════════',
    `⚡ الأولوية: ${priorityLabel}`,
  ];
  if (task.description) lines.push('', task.description);
  if (task.dueDate) lines.push('', `📅 الاستحقاق: ${fmtDateTime(task.dueDate)}`);
  if (task.reminderAt) lines.push(`🔔 التذكير: ${fmtDateTime(task.reminderAt)}`);
  lines.push('', `— مهمة من تطبيق ملاحظاتي`);
  return { title: task.title, body: lines.join('\n') };
};

export const formatEventForShare = (ev: AppEvent): { title: string; body: string } => {
  const lines: string[] = [
    `📅 ${ev.title}`,
    '═══════════════════',
    `🕐 يبدأ: ${fmtDateTime(ev.startDatetime)}`,
  ];
  if (ev.endDatetime) lines.push(`🏁 ينتهي: ${fmtDateTime(ev.endDatetime)}`);
  if (ev.allDay) lines.push('☀️ يوم كامل');
  if (ev.location) lines.push(`📍 المكان: ${ev.location}`);
  if (ev.repeat && ev.repeat !== 'none') {
    const repeatLabel: Record<string, string> = {
      daily: 'يومياً', weekly: 'أسبوعياً', monthly: 'شهرياً', yearly: 'سنوياً'
    };
    lines.push(`🔁 يتكرر: ${repeatLabel[ev.repeat] || ev.repeat}`);
  }
  if (ev.description) lines.push('', ev.description);
  lines.push('', `— حدث من تطبيق ملاحظاتي`);
  return { title: ev.title, body: lines.join('\n') };
};

export const formatShoppingListForShare = (list: ShoppingList): { title: string; body: string } => {
  const lines: string[] = [
    `🛒 قائمة تسوق: ${list.name}`,
    '═══════════════════',
  ];
  if (list.store) lines.push(`🏪 المتجر: ${list.store}`);
  if (list.budget) lines.push(`💰 الميزانية: ${list.budget.toLocaleString('ar-EG')}`);

  if (list.items.length > 0) {
    lines.push('', `📦 المنتجات (${list.items.filter(i => i.checked).length}/${list.items.length}):`);
    list.items.forEach(item => {
      const price = item.price ? ` — ${(item.price * item.qty).toFixed(1)}` : '';
      const note = item.note ? ` [${item.note}]` : '';
      lines.push(`${item.checked ? '✅' : '⬜'} ${item.name} ×${item.qty}${price}${note}`);
    });

    const totalCost = list.items.filter(i => i.price).reduce((s, i) => s + (i.price! * i.qty), 0);
    if (totalCost > 0) {
      lines.push('', `💳 إجمالي التكلفة المتوقعة: ${totalCost.toFixed(2)}`);
    }
  } else {
    lines.push('', 'القائمة فارغة');
  }

  lines.push('', `— من تطبيق ملاحظاتي`);
  return { title: list.name, body: lines.join('\n') };
};

/* ─────────────────────────────────────────────
   Universal share function
   ───────────────────────────────────────────── */
export const shareContent = async (
  title: string,
  body: string,
  showToast: (msg: string) => void
): Promise<void> => {
  try {
    const canUseShare = !!navigator.share && (typeof navigator.canShare !== 'function' || navigator.canShare({ title, text: body }));
    if (canUseShare) {
      await navigator.share({ title, text: body });
      showToast('✅ تمت المشاركة');
    } else {
      await navigator.clipboard.writeText(body);
      showToast('📋 تم نسخ المحتوى للحافظة (المشاركة غير متاحة)');
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    try {
      await navigator.clipboard.writeText(body);
      showToast('📋 تم نسخ المحتوى للحافظة');
    } catch {
      showToast('❌ تعذرت المشاركة');
    }
  }
};

/* ─────────────────────────────────────────────
   Duplicate helpers
   ───────────────────────────────────────────── */

export const duplicateNote = (note: Note): Note => {
  const now = new Date().toISOString();
  return {
    ...note,
    id: uid(),
    title: `${note.title} — نسخة`,
    createdAt: now,
    updatedAt: now,
    isPinned: false,
    isLocked: false,
    isTrash: false,
    isArchived: false,
    deletedAt: undefined,
    checklist: note.checklist?.map(c => ({ ...c, id: uid(), completed: false })),
  };
};

export const duplicateTask = (task: AppTask): AppTask => {
  const now = new Date().toISOString();
  return {
    ...task,
    id: uid(),
    title: `${task.title} — نسخة`,
    isCompleted: false,
    createdAt: now,
    updatedAt: now,
  };
};

export const duplicateEvent = (ev: AppEvent): AppEvent => {
  const now = new Date().toISOString();
  return {
    ...ev,
    id: uid(),
    title: `${ev.title} — نسخة`,
    isCompleted: false,
    createdAt: now,
    updatedAt: now,
  };
};

export const duplicateShoppingList = (list: ShoppingList): ShoppingList => {
  const now = new Date().toISOString();
  return {
    ...list,
    id: uid(),
    name: `${list.name} — نسخة`,
    items: list.items.map(item => ({ ...item, id: uid(), checked: false })),
    createdAt: now,
    updatedAt: now,
    isArchived: false,
  };
};
