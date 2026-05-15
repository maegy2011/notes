import React from 'react';
import { AppEvent } from '../types';
import {
  ArrowRight, Edit3, Trash2, MapPin, AlignLeft, Repeat,
  CalendarClock, Clock, CheckCircle2, Circle, Tag, Copy, Share2, CopyPlus,
} from 'lucide-react';

interface EventDetailModalProps {
  event: AppEvent;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onShare?: (event: AppEvent) => void;
  onDuplicate?: (event: AppEvent) => void;
  showToast: (msg: string) => void;
}

const EVENT_CATEGORY_LABEL: Record<string, string> = {
  meeting: '💼 اجتماع',
  birthday: '🎂 عيد ميلاد',
  holiday: '🌴 إجازة',
  personal: '🙍 شخصي',
  work: '💻 عمل',
  other: '📌 أخرى',
};

const EVENT_COLOR_BG: Record<string, string> = {
  amber: 'bg-amber-500/15 border-amber-500/40 text-amber-200',
  emerald: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200',
  sky: 'bg-sky-500/15 border-sky-500/40 text-sky-200',
  rose: 'bg-rose-500/15 border-rose-500/40 text-rose-200',
  purple: 'bg-purple-500/15 border-purple-500/40 text-purple-200',
  slate: 'bg-slate-700/50 border-slate-600 text-slate-200',
};

const EVENT_COLOR_DOT: Record<string, string> = {
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  rose: 'bg-rose-500',
  purple: 'bg-purple-500',
  slate: 'bg-slate-500',
};

const REPEAT_LABEL: Record<string, string> = {
  none: 'لا يتكرر',
  daily: 'يتكرر يومياً',
  weekly: 'يتكرر أسبوعياً',
  monthly: 'يتكرر شهرياً',
  yearly: 'يتكرر سنوياً',
};

const formatDT = (iso: string, allDay: boolean) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (allDay) {
    return d.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  return d.toLocaleString('ar-EG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const getDuration = (start: string, end: string) => {
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (diff <= 0) return null;
  const days = Math.floor(diff / 1440);
  const hrs = Math.floor((diff % 1440) / 60);
  const mins = diff % 60;
  const parts = [];
  if (days > 0) parts.push(`${days} يوم`);
  if (hrs > 0) parts.push(`${hrs} ساعة`);
  if (mins > 0) parts.push(`${mins} دقيقة`);
  return parts.join(' و');
};

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event, onClose, onEdit, onDelete, onToggleComplete, onShare, onDuplicate, showToast,
}) => {
  const colorStyle = EVENT_COLOR_BG[event.color] ?? EVENT_COLOR_BG.sky;
  const dotColor = EVENT_COLOR_DOT[event.color] ?? 'bg-sky-500';
  const duration = getDuration(event.startDatetime, event.endDatetime);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const handleCopy = () => {
    let text = `${event.title}\n`;
    text += `📅 ${formatDT(event.startDatetime, event.allDay)}\n`;
    if (!event.allDay && event.endDatetime) text += `⏰ ينتهي: ${formatDT(event.endDatetime, false)}\n`;
    if (event.location) text += `📍 ${event.location}\n`;
    if (event.description) text += `\n${event.description}`;
    navigator.clipboard.writeText(text);
    showToast('تم نسخ تفاصيل الحدث');
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-40 flex flex-col animate-slideUp overflow-hidden">
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${colorStyle} shrink-0`}>
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-slate-300 hover:text-white bg-slate-900/60 py-1 pr-1 pl-3 rounded-lg"
        >
          <ArrowRight size={18} />
          <span className="text-xs">رجوع</span>
        </button>

        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900/50">
          {EVENT_CATEGORY_LABEL[event.category] || 'حدث'}
        </span>

        <div className="flex items-center gap-1">
          <button onClick={handleCopy} className="p-1.5 rounded-lg bg-slate-900/40 text-slate-300 hover:text-white" title="نسخ النص">
            <Copy size={16} />
          </button>
          {onShare && (
            <button onClick={() => onShare(event)} className="p-1.5 rounded-lg bg-slate-900/40 text-slate-300 hover:text-sky-400" title="مشاركة">
              <Share2 size={16} />
            </button>
          )}
          {onDuplicate && (
            <button onClick={() => onDuplicate(event)} className="p-1.5 rounded-lg bg-slate-900/40 text-slate-300 hover:text-purple-400" title="إنشاء نسخة">
              <CopyPlus size={16} />
            </button>
          )}
          <button onClick={onEdit} className="p-1.5 rounded-lg bg-slate-900/40 text-slate-300 hover:text-amber-400" title="تعديل">
            <Edit3 size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Color dot + title */}
        <div className="flex items-start gap-3">
          <div className={`w-4 h-4 rounded-full ${dotColor} shrink-0 mt-1`} />
          <h2 className={`text-lg font-extrabold leading-snug break-words ${event.isCompleted ? 'line-through opacity-60' : 'text-white'}`}>
            {event.title}
          </h2>
        </div>

        {/* Datetime block */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <CalendarClock size={15} className="text-sky-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-200 space-y-1">
              <p className="font-medium">{formatDT(event.startDatetime, event.allDay)}</p>
              {!event.allDay && event.endDatetime && (
                <p className="text-slate-400">حتى: {formatDT(event.endDatetime, event.allDay)}</p>
              )}
            </div>
          </div>

          {duration && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400 pr-6">
              <Clock size={12} className="text-slate-500" />
              <span>المدة: {duration}</span>
            </div>
          )}

          {event.allDay && (
            <div className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1 pr-6">
              ☀️ يوم كامل
            </div>
          )}

          {event.repeat !== 'none' && (
            <div className="flex items-center gap-2 text-[11px] text-purple-300 pr-6">
              <Repeat size={12} />
              <span>{REPEAT_LABEL[event.repeat]}</span>
            </div>
          )}
        </div>

        {/* Location */}
        {event.location && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-start gap-2.5">
              <MapPin size={15} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-slate-500 mb-1">المكان</p>
                <p className="text-xs text-slate-200">{event.location}</p>
              </div>
            </div>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-start gap-2.5">
              <AlignLeft size={15} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-slate-500 mb-1">الوصف</p>
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{event.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Created */}
        <div className="flex items-center gap-2 text-[10px] text-slate-500 pr-1">
          <Tag size={11} />
          <span>أُنشئ في {new Date(event.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>

        {/* Delete confirm */}
        {confirmDelete && (
          <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-3 space-y-2.5">
            <p className="text-xs text-rose-200 text-center">هل أنت متأكد من حذف هذا الحدث نهائياً؟</p>
            <div className="flex gap-2">
              <button
                onClick={() => { onDelete(event.id); onClose(); }}
                className="flex-1 bg-rose-500 hover:bg-rose-400 text-white py-2 rounded-xl text-xs font-bold"
              >
                نعم، احذف
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 bg-slate-800 text-slate-300 py-2 rounded-xl text-xs"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0 flex items-center gap-2">
        <button
          onClick={() => onToggleComplete(event.id)}
          className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
            event.isCompleted
              ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/10'
          }`}
        >
          {event.isCompleted ? <Circle size={16} className="stroke-[2.5]" /> : <CheckCircle2 size={16} className="stroke-[2.5]" />}
          <span>{event.isCompleted ? 'إلغاء الإنجاز' : 'تمييز كمنجز'}</span>
        </button>

        <button
          onClick={onEdit}
          className="p-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 rounded-xl border border-sky-500/20"
        >
          <Edit3 size={16} />
        </button>

        <button
          onClick={() => setConfirmDelete(true)}
          className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-xl border border-rose-500/20"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
