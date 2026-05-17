import React from 'react';
import { Note } from '../types';
import { CATEGORY_LABELS, COLOR_CLASSES } from '../data/initialNotes';
import DOMPurify from 'dompurify';
import {
  Pin,
  Star,
  CheckSquare,
  Trash2,
  Archive,
  RefreshCw,
  Lock as LockIcon,
  Bell,
  CalendarClock,
  ListTodo,
} from 'lucide-react';

export type ViewMode = 'list' | 'details' | 'grid' | 'large_grid';

interface NoteCardProps {
  note: Note;
  onSelect: (note: Note) => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onToggleLock?: (id: string, e: React.MouseEvent) => void;
  onArchive: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onRestore?: (id: string, e: React.MouseEvent) => void;
  viewMode?: ViewMode;
  isCompact?: boolean;
}

const formatReminder = (iso?: string) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ar-EG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  onSelect,
  onTogglePin,
  onToggleFavorite,
  onToggleLock,
  onArchive,
  onDelete,
  onRestore,
  viewMode = 'grid',
}) => {
  const colorStyle = COLOR_CLASSES[note.color] || COLOR_CLASSES.slate;
  const totalItems = note.checklist?.length || 0;
  const completedItems = note.checklist?.filter(item => item.completed).length || 0;
  const taskReminderCount = note.checklist?.filter(item => !!item.reminderAt).length || 0;
  const hasNoteReminder = !!note.reminder?.datetime;

  const formattedDate = new Date(note.updatedAt).toLocaleDateString('ar-EG', {
    month: 'short',
    day: 'numeric'
  });

  const getDaysUntilDeletion = () => {
    if (!note.deletedAt) return null;
    const deleted = new Date(note.deletedAt);
    const thirtyDaysLater = new Date(deleted);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const daysLeft = Math.ceil((thirtyDaysLater.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysLeft);
  };
  const daysUntilDeletion = getDaysUntilDeletion();

  // Compact list view
  if (viewMode === 'list') {
    return (
      <div
        onClick={() => onSelect(note)}
        className={`rounded-xl border transition-all cursor-pointer flex items-center justify-between p-2.5 gap-2 ${colorStyle.bg} ${colorStyle.border}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${colorStyle.badgeBg} ${colorStyle.badgeText}`}>
            {CATEGORY_LABELS[note.category] || 'عام'}
          </span>

          <h3 className="text-xs font-bold text-white truncate flex-1 tracking-tight flex items-center gap-1">
            {note.isLocked && <LockIcon size={10} className="text-sky-400 shrink-0" />}
            {note.title || 'بدون عنوان'}
          </h3>

          {totalItems > 0 && !note.isLocked && (
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0 bg-slate-900/40 px-1.5 py-0.5 rounded">
              <CheckSquare size={10} className="text-amber-400" />
              {completedItems}/{totalItems}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {hasNoteReminder && <Bell size={11} className="text-sky-400 ml-0.5" />}
          {taskReminderCount > 0 && <ListTodo size={11} className="text-purple-400 ml-0.5" />}
          <button
            onClick={(e) => onToggleFavorite(note.id, e)}
            className="p-1 text-slate-500 hover:text-amber-400 transition-colors"
            title="تفضيل"
          >
            <Star size={13} className={note.isFavorite ? 'text-amber-400 fill-amber-400' : ''} />
          </button>

          {!note.isArchived && (
            <button
              onClick={(e) => onTogglePin(note.id, e)}
              className="p-1 text-slate-500 hover:text-white transition-colors"
              title={note.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}
            >
              <Pin size={13} className={note.isPinned ? 'text-white fill-white rotate-45' : ''} />
            </button>
          )}

          <span className="text-[10px] text-slate-500 mr-1">{formattedDate}</span>
        </div>
      </div>
    );
  }

 const appSettings = React.useMemo(() => {
    try {
      const saved = localStorage.getItem('notes_app_settings_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      defaultFontSize: 'base',
      listItemHeight: 'normal'
    };
  }, []);

  // 1. Font Size mapping
  const fontSizeClass: Record<string, string> = {
    sm: 'text-[10px]',
    base: 'text-xs',
    lg: 'text-sm',
    xl: 'text-base'
  };
  const currentFontSize = fontSizeClass[appSettings.defaultFontSize] || 'text-xs';

  // 2. List Item Height mapping
  const itemHeightClass: Record<string, string> = {
    normal: 'p-3.5',
    small: 'p-2.5',
    tiny: 'p-1.5'
  };
  const currentItemHeight = itemHeightClass[appSettings.listItemHeight] || 'p-3.5';

  let titleClass = `${currentFontSize} font-bold`;
  let contentLineClamp = 'line-clamp-2';
  let paddingClass = currentItemHeight;

  if (viewMode === 'details') {
    const detailSizeClass: Record<string, string> = {
      sm: 'text-xs',
      base: 'text-sm',
      lg: 'text-base',
      xl: 'text-lg'
    };
    titleClass = `${detailSizeClass[appSettings.defaultFontSize] || 'text-sm'} font-extrabold`;
    contentLineClamp = 'line-clamp-4';
    paddingClass = appSettings.listItemHeight === 'tiny' ? 'p-2' : appSettings.listItemHeight === 'small' ? 'p-3' : 'p-4';
  } else if (viewMode === 'large_grid') {
    const largeSizeClass: Record<string, string> = {
      sm: 'text-xs',
      base: 'text-sm',
      lg: 'text-base',
      xl: 'text-lg'
    };
    titleClass = `${largeSizeClass[appSettings.defaultFontSize] || 'text-sm'} font-bold`;
    contentLineClamp = 'line-clamp-5';
    paddingClass = appSettings.listItemHeight === 'tiny' ? 'p-2.5' : appSettings.listItemHeight === 'small' ? 'p-3.5' : 'p-4.5';
  }

  return (
    <div
      onClick={() => onSelect(note)}
      className={`rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${colorStyle.bg} ${colorStyle.border} ${paddingClass} ${note.isTrash ? 'opacity-75 grayscale-[0.3]' : ''}`}
    >
      {note.isLocked && (
        <div className="absolute top-0 left-0 bg-sky-600/80 text-white text-[9px] px-2 py-0.5 rounded-br-lg font-bold z-10 flex items-center gap-1">
          <LockIcon size={10} />
          <span>مقفلة</span>
        </div>
      )}

      {note.isTrash && (
        <div className="absolute top-0 left-0 bg-rose-500/80 text-white text-[9px] px-2 py-0.5 rounded-br-lg font-bold z-10">
          🗑️ في سلة المهملات
        </div>
      )}

      <div className={`flex items-start justify-between gap-2 mb-2 ${note.isTrash || note.isLocked ? 'mt-4' : ''}`}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${colorStyle.badgeBg} ${colorStyle.badgeText}`}>
            {CATEGORY_LABELS[note.category] || 'عام'}
          </span>

          {note.isTrash && daysUntilDeletion !== null && (
            <span className="text-[9px] bg-rose-500/20 border border-rose-500/30 text-rose-300 px-1.5 py-0.5 rounded font-sans">
              حذف نهائي خلال {daysUntilDeletion} يوم
            </span>
          )}

          {hasNoteReminder && (
            <span className="text-[9px] bg-sky-500/10 border border-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-sans">
              {note.reminder?.type === 'event' ? <CalendarClock size={9} /> : <Bell size={9} />}
              {note.reminder?.type === 'event' ? 'حدث' : 'تذكير'}
            </span>
          )}

          {taskReminderCount > 0 && (
            <span className="text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-sans">
              <ListTodo size={9} />
              {taskReminderCount} مهام
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => onToggleFavorite(note.id, e)}
            className="p-1 text-slate-400 hover:text-amber-400 transition-colors rounded-lg"
            title="تفضيل"
          >
            <Star size={15} className={note.isFavorite ? 'text-amber-400 fill-amber-400' : ''} />
          </button>

          {!note.isArchived && !note.isTrash && onToggleLock && (
            <button
              onClick={(e) => onToggleLock(note.id, e)}
              className="p-1 text-slate-400 hover:text-sky-400 transition-colors rounded-lg"
              title={note.isLocked ? 'إلغاء القفل' : 'قفل الملاحظة'}
            >
              <LockIcon size={15} className={note.isLocked ? 'text-sky-400 fill-sky-400' : ''} />
            </button>
          )}

          {!note.isArchived && (
            <button
              onClick={(e) => onTogglePin(note.id, e)}
              className="p-1 text-slate-400 hover:text-white transition-colors rounded-lg"
              title={note.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}
            >
              <Pin size={15} className={note.isPinned ? 'text-white fill-white rotate-45' : ''} />
            </button>
          )}
        </div>
      </div>

      <div className="mb-3">
        <h3 className={`${titleClass} text-white line-clamp-1 mb-1.5 tracking-tight`}>
          {note.title || 'بدون عنوان'}
          {note.isLocked && <LockIcon size={11} className="inline mr-1 text-sky-400 -mt-0.5" />}
        </h3>

        {note.isLocked ? (
          <div className="flex items-center gap-1.5 text-sky-400/70 text-[10px] py-2">
            <LockIcon size={13} />
            <span>ملاحظة مقفلة - اضغط لإدخال الرقم السري</span>
          </div>
        ) : note.content ? (

          <div
            className={`${currentFontSize} text-slate-300 ${contentLineClamp} leading-relaxed font-light overflow-hidden rich-text-preview`}
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(note.content, {
                ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'p', 'br',
                               'ul', 'ol', 'li', 'h1', 'h2', 'h3',
                               'blockquote', 'code', 'pre', 'span'],
                ALLOWED_ATTR: ['class'],
                FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
                FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
              })
            }}
          />
        ) : totalItems === 0 ? (
          <span className="italic text-slate-500 text-[10px]">فارغة...</span>
        ) : null}

        {hasNoteReminder && (
          <div className="mt-2.5 text-[10px] text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-lg px-2 py-1 flex items-center gap-1.5 w-fit max-w-full">
            {note.reminder?.type === 'event' ? <CalendarClock size={11} /> : <Bell size={11} />}
            <span className="truncate">{formatReminder(note.reminder?.datetime)}</span>
          </div>
        )}

        {viewMode === 'details' && note.checklist && note.checklist.length > 0 && (
          <div className="mt-2.5 space-y-1 border-t border-slate-700/30 pt-2">
            {note.checklist.slice(0, 3).map(item => (
              <div key={item.id} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                <span className={item.completed ? 'text-amber-500' : 'text-slate-600'}>
                  {item.completed ? '✓' : '•'}
                </span>
                <span className={`truncate ${item.completed ? 'line-through text-slate-500' : ''}`}>
                  {item.text}
                </span>
                {item.reminderAt && <Bell size={10} className="text-sky-400 shrink-0" />}
              </div>
            ))}
          </div>
        )}

        {totalItems > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-900/40 px-2 py-1 rounded-md w-fit">
            <CheckSquare size={12} className="text-amber-400" />
            <span>{completedItems} / {totalItems} مكتمل</span>
            <div className="w-12 h-1 bg-slate-700 rounded-full mr-1 overflow-hidden inline-block">
              <div
                className="h-full bg-amber-400 rounded-full"
                style={{ width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-700/30">
        <span>{formattedDate}</span>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {note.isTrash ? (
            <>
              {onRestore && (
                <button
                  onClick={(e) => onRestore(note.id, e)}
                  className="p-1 text-slate-400 hover:text-sky-400 rounded transition-colors flex items-center gap-0.5"
                  title="استعادة من سلة المهملات"
                >
                  <RefreshCw size={12} />
                  <span className="text-[9px]">استعادة</span>
                </button>
              )}
              <button
                onClick={(e) => onDelete(note.id, e)}
                className="p-1 text-rose-400 hover:text-rose-300 rounded transition-colors flex items-center gap-0.5"
                title="حذف نهائي"
              >
                <Trash2 size={12} />
                <span className="text-[9px]">حذف نهائي</span>
              </button>
            </>
          ) : note.isArchived ? (
            <button
              onClick={(e) => onArchive(note.id, e)}
              className="p-1 text-slate-400 hover:text-sky-400 rounded transition-colors flex items-center gap-0.5"
              title="استعادة من الأرشيف"
            >
              <RefreshCw size={12} />
              <span className="text-[9px]">استعادة</span>
            </button>
          ) : (
            <>
              <button
                onClick={(e) => onArchive(note.id, e)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded transition-colors"
                title="أرشفة"
              >
                <Archive size={13} />
              </button>
              <button
                onClick={(e) => onDelete(note.id, e)}
                className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
                title="حذف"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
