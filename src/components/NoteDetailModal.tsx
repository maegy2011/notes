import React from 'react';
import { Note } from '../types';
import { CATEGORY_LABELS, COLOR_CLASSES } from '../data/initialNotes';
import DOMPurify from 'dompurify';
import {
  ArrowRight,
  Edit3,
  Star,
  Pin,
  Share2,
  Copy,
  Calendar,
  CheckSquare,
  Archive,
  RefreshCw,
  Trash2,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  Bell,
  CalendarClock,
  MapPin,
  CopyPlus,
} from 'lucide-react';

interface NoteDetailModalProps {
  note: Note;
  onClose: () => void;
  onEdit: () => void;
  onToggleChecklist: (itemId: string) => void;
  onTogglePin: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onToggleLock?: (id: string) => void;
  onRestoreFromTrash?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
  onShare?: (note: Note) => void;
  onDuplicate?: (note: Note) => void;
  showToast: (msg: string) => void;
}

const formatReminder = (iso?: string) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const NoteDetailModal: React.FC<NoteDetailModalProps> = ({
  note,
  onClose,
  onEdit,
  onToggleChecklist,
  onTogglePin,
  onToggleFavorite,
  onToggleArchive,
  onToggleLock,
  onRestoreFromTrash,
  onPermanentDelete,
  onShare,
  onDuplicate,
  showToast
}) => {
  const colorStyle = COLOR_CLASSES[note.color] || COLOR_CLASSES.slate;

  const formattedDate = new Date(note.updatedAt).toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedTime = new Date(note.updatedAt).toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const handleCopy = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = DOMPurify.sanitize(note.content, {
      ALLOWED_TAGS: [], ALLOWED_ATTR: [],
    });
    let text = `${note.title}\n\n${tempDiv.textContent || tempDiv.innerText || ''}`;
    if (note.reminder?.datetime) {
      text += `\n\n⏰ ${note.reminder.type === 'event' ? 'الحدث' : 'التذكير'}: ${formatReminder(note.reminder.datetime)}`;
      if (note.reminder.endDatetime) text += `\n🏁 النهاية: ${formatReminder(note.reminder.endDatetime)}`;
      if (note.reminder.location) text += `\n📍 المكان: ${note.reminder.location}`;
    }
    if (note.checklist && note.checklist.length > 0) {
      text += '\n\n' + note.checklist.map(c => `${c.completed ? '✅' : '⬜'} ${c.text}${c.reminderAt ? ` (⏰ ${formatReminder(c.reminderAt)})` : ''}`).join('\n');
    }
    navigator.clipboard.writeText(text);
    showToast('تم نسخ محتوى الملاحظة');
  };

  const handleShare = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = DOMPurify.sanitize(note.content, {
      ALLOWED_TAGS: [], ALLOWED_ATTR: [],
    });
    if (navigator.share) {
      navigator.share({
        title: note.title,
        text: tempDiv.textContent || tempDiv.innerText || 'ملاحظة من تطبيق ملاحظاتي'
      }).catch(() => showToast('لم تتم المشاركة'));
    } else {
      handleCopy();
    }
  };

  const totalItems = note.checklist?.length || 0;
  const completedItems = note.checklist?.filter(c => c.completed).length || 0;
  const taskReminderCount = note.checklist?.filter(item => !!item.reminderAt).length || 0;

  return (
    <div className="fixed inset-0 bg-slate-950 z-30 flex flex-col animate-slideUp select-none overflow-hidden">
      <div className={`flex items-center justify-between px-4 py-3 border-b ${colorStyle.bg} ${colorStyle.border} shrink-0`}>
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-slate-300 hover:text-white bg-slate-900/60 py-1 pr-1 pl-3 rounded-lg backdrop-blur-sm transition-colors"
        >
          <ArrowRight size={18} />
          <span className="text-xs">رجوع</span>
        </button>

        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${colorStyle.badgeBg} ${colorStyle.badgeText}`}>
          {CATEGORY_LABELS[note.category] || 'عام'}
        </span>

        <div className="flex items-center gap-1">
          {onToggleLock && !note.isTrash && !note.isArchived && (
            <button
              onClick={() => onToggleLock(note.id)}
              className="p-1.5 text-slate-300 hover:text-sky-400 rounded-lg bg-slate-900/40 transition-colors"
              title={note.isLocked ? 'إلغاء القفل' : 'قفل الملاحظة'}
            >
              {note.isLocked ? (
                <LockIcon size={16} className="text-sky-400 fill-sky-400/30" />
              ) : (
                <UnlockIcon size={16} />
              )}
            </button>
          )}

          <button
            onClick={() => onToggleFavorite(note.id)}
            className="p-1.5 text-slate-300 hover:text-amber-400 rounded-lg bg-slate-900/40 transition-colors"
            title="تفضيل"
          >
            <Star size={16} className={note.isFavorite ? 'text-amber-400 fill-amber-400' : ''} />
          </button>

          {!note.isArchived && (
            <button
              onClick={() => onTogglePin(note.id)}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg bg-slate-900/40 transition-colors"
              title={note.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}
            >
              <Pin size={16} className={note.isPinned ? 'text-white fill-white rotate-45' : ''} />
            </button>
          )}
        </div>
      </div>

      {note.isArchived && !note.isTrash && (
        <div className="bg-slate-800/90 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-slate-300 text-xs">
            <Archive size={14} className="text-amber-400" />
            <span>هذه الملاحظة في الأرشيف (للقراءة فقط)</span>
          </div>
          <button
            onClick={() => onToggleArchive(note.id)}
            className="text-[11px] bg-slate-700 hover:bg-slate-600 text-amber-400 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
          >
            <RefreshCw size={12} />
            <span>استعادة للتعديل</span>
          </button>
        </div>
      )}

      {note.isTrash && (
        <div className="bg-rose-950/80 border-b border-rose-900/50 px-4 py-2.5 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-200 text-xs">
              <Trash2 size={14} className="text-rose-400" />
              <span>هذه الملاحظة في سلة المهملات</span>
            </div>
            {onRestoreFromTrash && (
              <button
                onClick={() => onRestoreFromTrash(note.id)}
                className="text-[11px] bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
              >
                <RefreshCw size={12} />
                <span>استعادة</span>
              </button>
            )}
          </div>
          <p className="text-[10px] text-rose-400/80">
            ⚠️ سيتم حذف هذه الملاحظة نهائياً تلقائياً بعد 30 يوماً من وضعها في السلة.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <h2 className="text-lg font-bold text-white tracking-tight leading-snug break-words">
          {note.title || 'بدون عنوان'}
        </h2>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 pb-3 border-b border-slate-900">
          <Calendar size={13} className="text-slate-400" />
          <span>{formattedDate} • {formattedTime}</span>
        </div>

        {note.reminder?.datetime && (
          <div className="space-y-2 bg-sky-500/10 border border-sky-500/20 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sky-300 text-xs font-bold">
                {note.reminder.type === 'event' ? <CalendarClock size={14} /> : <Bell size={14} />}
                <span>{note.reminder.type === 'event' ? 'تفاصيل الحدث' : 'تذكير الملاحظة'}</span>
              </div>
              {taskReminderCount > 0 && (
                <span className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-full">
                  {taskReminderCount} مهام لها تذكير
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-200 space-y-1">
              <div className="flex items-center gap-2">
                <Bell size={12} className="text-sky-400" />
                <span>{formatReminder(note.reminder.datetime)}</span>
              </div>

              {note.reminder.endDatetime && (
                <div className="flex items-center gap-2">
                  <CalendarClock size={12} className="text-sky-400" />
                  <span>ينتهي في: {formatReminder(note.reminder.endDatetime)}</span>
                </div>
              )}

              {note.reminder.location && (
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-sky-400" />
                  <span>{note.reminder.location}</span>
                </div>
              )}

              {note.reminder.note && (
                <p className="text-[11px] text-slate-300 pt-1">{note.reminder.note}</p>
              )}
            </div>
          </div>
        )}

        {note.content && (
          <div
            className="text-xs text-slate-200 leading-relaxed font-normal select-text break-words bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60 rich-text-view"
           dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.content, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'p', 'br',
                           'ul', 'ol', 'li', 'h1', 'h2', 'h3',
                           'blockquote', 'code', 'pre', 'span', 'del', 'a'],
            ALLOWED_ATTR: ['class', 'href', 'target', 'rel'],
            FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form',
                          'input', 'textarea', 'button', 'style'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover',
                          'onfocus', 'onblur', 'onsubmit', 'style'],
            ALLOW_DATA_ATTR: false,
            // Force all links to have rel="noopener noreferrer"
            ADD_ATTR: ['rel'],
          }) }}
        )}

        {note.checklist && note.checklist.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <CheckSquare size={14} className="text-amber-400" />
                قائمة المهام
              </span>
              <span className="text-[11px]">
                {completedItems} من {totalItems} منجزة
              </span>
            </div>

            <div className="space-y-1.5 bg-slate-900/30 p-2 rounded-2xl border border-slate-800/40">
              {note.checklist.map((item) => (
                <label
                  key={item.id}
                  onClick={() => {
                    if (!note.isArchived) {
                      onToggleChecklist(item.id);
                    } else {
                      showToast('قم باستعادة الملاحظة من الأرشيف لتعديل المهام');
                    }
                  }}
                  className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors ${
                    note.isArchived ? 'opacity-70 cursor-not-allowed' : 'hover:bg-slate-850/50 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    readOnly
                    className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-0 w-4 h-4 bg-slate-800 accent-amber-500 pointer-events-none"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <span className={`text-xs select-none transition-all leading-relaxed block ${
                      item.completed ? 'line-through text-slate-500' : 'text-slate-200'
                    }`}>
                      {item.text}
                    </span>
                    {item.reminderAt && (
                      <div className="text-[10px] text-sky-300 flex items-center gap-1.5">
                        <Bell size={10} />
                        <span>{formatReminder(item.reminderAt)}</span>
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0 flex items-center gap-2">
        {note.isTrash ? (
          <>
            {onRestoreFromTrash && (
              <button
                onClick={() => onRestoreFromTrash(note.id)}
                className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-950 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/10 transition-transform active:scale-95"
              >
                <RefreshCw size={16} className="stroke-[2.5]" />
                <span>استعادة الملاحظة</span>
              </button>
            )}
            {onPermanentDelete && (
              <button
                onClick={() => onPermanentDelete(note.id)}
                className="flex-1 bg-rose-500 hover:bg-rose-400 text-slate-950 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-500/10 transition-transform active:scale-95"
              >
                <Trash2 size={16} className="stroke-[2.5]" />
                <span>حذف نهائي</span>
              </button>
            )}
          </>
        ) : !note.isArchived ? (
          <button
            onClick={onEdit}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10 transition-transform active:scale-95"
          >
            <Edit3 size={16} className="stroke-[2.5]" />
            <span>تعديل الملاحظة</span>
          </button>
        ) : (
          <button
            onClick={() => onToggleArchive(note.id)}
            className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-950 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/10 transition-transform active:scale-95"
          >
            <RefreshCw size={16} className="stroke-[2.5]" />
            <span>استعادة الملاحظة</span>
          </button>
        )}

        {!note.isArchived && !note.isTrash && (
          <button
            onClick={() => onToggleArchive(note.id)}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1 text-xs px-3"
            title="أرشفة"
          >
            <Archive size={16} />
            <span className="hidden xs:inline">أرشفة</span>
          </button>
        )}

        {!note.isTrash && (
          <>
            {onDuplicate && (
              <button
                onClick={() => onDuplicate(note)}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded-xl border border-slate-700 transition-colors"
                title="إنشاء نسخة (Duplicate)"
              >
                <CopyPlus size={16} />
              </button>
            )}

            <button
              onClick={handleCopy}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
              title="نسخ النص للحافظة"
            >
              <Copy size={16} />
            </button>

            <button
              onClick={() => onShare ? onShare(note) : handleShare()}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-xl border border-slate-700 transition-colors"
              title="مشاركة"
            >
              <Share2 size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
