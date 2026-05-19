import React, { useState, useEffect } from 'react';
import { AppEvent, EventCategory, EventColor, RepeatType } from '../types';
import {
  ArrowRight, Check, MapPin, AlignLeft, Repeat,
  Tag, Palette, Calendar, Clock, Sun, Trash2,
} from 'lucide-react';

interface EventEditorProps {
  event: AppEvent | null; // null = create new
  initialDate?: Date;
  onSave: (ev: Omit<AppEvent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  showToast: (msg: string) => void;
}

const EVENT_CATEGORIES: { id: EventCategory; label: string; emoji: string }[] = [
  { id: 'meeting', label: 'اجتماع', emoji: '💼' },
  { id: 'birthday', label: 'عيد ميلاد', emoji: '🎂' },
  { id: 'holiday', label: 'إجازة', emoji: '🌴' },
  { id: 'personal', label: 'شخصي', emoji: '🙍' },
  { id: 'work', label: 'عمل', emoji: '💻' },
  { id: 'other', label: 'أخرى', emoji: '📌' },
];

const REPEAT_OPTIONS: { id: RepeatType; label: string }[] = [
  { id: 'none', label: 'لا يتكرر' },
  { id: 'daily', label: 'يومياً' },
  { id: 'weekly', label: 'أسبوعياً' },
  { id: 'monthly', label: 'شهرياً' },
  { id: 'yearly', label: 'سنوياً' },
];

const EVENT_COLORS: { id: EventColor; bg: string; label: string }[] = [
  { id: 'amber', bg: 'bg-amber-500', label: 'كهرماني' },
  { id: 'emerald', bg: 'bg-emerald-500', label: 'أخضر' },
  { id: 'sky', bg: 'bg-sky-500', label: 'سماوي' },
  { id: 'rose', bg: 'bg-rose-500', label: 'وردي' },
  { id: 'purple', bg: 'bg-purple-500', label: 'بنفسجي' },
  { id: 'slate', bg: 'bg-slate-500', label: 'رمادي' },
];

const COLOR_RING: Record<EventColor, string> = {
  amber: 'ring-amber-500',
  emerald: 'ring-emerald-500',
  sky: 'ring-sky-500',
  rose: 'ring-rose-500',
  purple: 'ring-purple-500',
  slate: 'ring-slate-400',
};

const toLocalInput = (iso: string) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
  } catch { return ''; }
};

const fromLocalInput = (val: string): string => {
  if (!val) return '';
  return new Date(val).toISOString();
};

const defaultStart = (d?: Date) => {
  const base = d ? new Date(d) : new Date();
  base.setMinutes(0, 0, 0);
  base.setHours(base.getHours() + 1);
  return base.toISOString();
};

const defaultEnd = (startIso: string) => {
  const d = new Date(startIso);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
};

export const EventEditor: React.FC<EventEditorProps> = ({
  event, initialDate, onSave, onDelete, onClose, showToast,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDatetime, setStartDatetime] = useState('');
  const [endDatetime, setEndDatetime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [category, setCategory] = useState<EventCategory>('personal');
  const [color, setColor] = useState<EventColor>('sky');
  const [location, setLocation] = useState('');
  const [repeat, setRepeat] = useState<RepeatType>('none');
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description);
      setStartDatetime(toLocalInput(event.startDatetime));
      setEndDatetime(toLocalInput(event.endDatetime));
      setAllDay(event.allDay);
      setCategory(event.category);
      setColor(event.color);
      setLocation(event.location);
      setRepeat(event.repeat);
    } else {
      const start = defaultStart(initialDate);
      const end = defaultEnd(start);
      setStartDatetime(toLocalInput(start));
      setEndDatetime(toLocalInput(end));
    }
  }, [event, initialDate]);

  const handleStartChange = (val: string) => {
    setStartDatetime(val);
    if (!event && val) {
      const end = new Date(new Date(val).getTime() + 60 * 60 * 1000);
      setEndDatetime(toLocalInput(end.toISOString()));
    }
  };

  const handleSave = () => {
    if (!title.trim()) { showToast('يرجى إدخال عنوان الحدث'); return; }
    if (!startDatetime) { showToast('يرجى تحديد تاريخ ووقت البداية'); return; }
    if (!allDay && endDatetime && new Date(fromLocalInput(endDatetime)) <= new Date(fromLocalInput(startDatetime))) {
      showToast('يجب أن يكون وقت النهاية بعد وقت البداية'); return;
    }

    onSave({
      id: event?.id,
      title: title.trim(),
      description: description.trim(),
      startDatetime: fromLocalInput(startDatetime),
      endDatetime: fromLocalInput(endDatetime || startDatetime),
      allDay,
      category,
      color,
      location: location.trim(),
      repeat,
      isCompleted: event?.isCompleted ?? false,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-40 flex flex-col animate-slideUp overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-slate-400 hover:text-white py-1 pr-1 pl-3 rounded-lg bg-slate-800/60"
        >
          <ArrowRight size={18} />
          <span className="text-xs">رجوع</span>
        </button>

        <span className="text-xs font-bold text-slate-200">
          {event ? 'تعديل الحدث' : 'حدث جديد'}
        </span>

        <button
          onClick={handleSave}
          className="bg-sky-500 hover:bg-sky-400 text-slate-950 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1"
        >
          <Check size={14} className="stroke-[2.5]" />
          <span>حفظ</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className={`h-1.5 rounded-full ${EVENT_COLORS.find(c => c.id === color)?.bg ?? 'bg-sky-500'}`} />

        <input
          type="text"
          dir="auto"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="عنوان الحدث..."
          className="w-full bg-transparent text-white text-base font-bold placeholder:text-slate-600 border-b border-slate-800 pb-2 focus:outline-none focus:border-sky-500/60 transition-colors"
        />

        <div className="flex items-center justify-between bg-slate-900/60 rounded-xl border border-slate-800 px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs text-slate-200">
            <Sun size={15} className="text-amber-400" />
            <span>يوم كامل</span>
          </div>
          <button
            onClick={() => setAllDay(p => !p)}
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${allDay ? 'bg-sky-500' : 'bg-slate-700'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${allDay ? 'translate-x-0' : '-translate-x-4'}`} />
          </button>
        </div>

        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-3 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold mb-1">
            <Calendar size={13} className="text-sky-400" />
            <span>التوقيت</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">البداية</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? startDatetime.slice(0, 10) : startDatetime}
                onChange={e => handleStartChange(allDay ? e.target.value + 'T00:00' : e.target.value)}
                className="w-full bg-slate-950 text-slate-100 text-[11px] rounded-xl px-2.5 py-2 border border-slate-800 focus:outline-none focus:border-sky-500/50"
              />
            </div>

            {!allDay && (
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">النهاية</label>
                <input
                  type="datetime-local"
                  value={endDatetime}
                  onChange={e => setEndDatetime(e.target.value)}
                  className="w-full bg-slate-950 text-slate-100 text-[11px] rounded-xl px-2.5 py-2 border border-slate-800 focus:outline-none focus:border-sky-500/50"
                />
              </div>
            )}
          </div>

          {!allDay && startDatetime && endDatetime && (
            (() => {
              const diff = (new Date(fromLocalInput(endDatetime)).getTime() - new Date(fromLocalInput(startDatetime)).getTime()) / 60000;
              if (diff <= 0) return null;
              const hrs = Math.floor(diff / 60);
              const mins = diff % 60;
              return (
                <div className="text-[10px] text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                  <Clock size={11} />
                  <span>المدة: {hrs > 0 ? `${hrs} ساعة` : ''}{mins > 0 ? ` ${mins} دقيقة` : ''}</span>
                </div>
              );
            })()
          )}
        </div>

        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
            <MapPin size={13} className="text-emerald-400" />
            <span>المكان</span>
          </div>
          <input
            type="text"
            dir="auto"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="المكان أو رابط الاجتماع..."
            className="w-full bg-slate-950 text-slate-100 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-sky-500/50 placeholder:text-slate-600"
          />
        </div>

        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
            <AlignLeft size={13} className="text-slate-400" />
            <span>الوصف</span>
          </div>
          <textarea
            dir="auto"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="أضف وصفاً أو ملاحظات عن الحدث..."
            className="w-full bg-slate-950 text-slate-100 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-sky-500/50 resize-none leading-relaxed placeholder:text-slate-600"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
            <Tag size={13} className="text-slate-400" />
            <span>فئة الحدث</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {EVENT_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`py-2 px-1.5 rounded-xl border text-xs flex flex-col items-center gap-1 transition-all ${
                  category === cat.id
                    ? 'bg-sky-500/15 border-sky-500 text-sky-300 font-bold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="text-base">{cat.emoji}</span>
                <span className="text-[10px]">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
            <Palette size={13} className="text-slate-400" />
            <span>لون الحدث</span>
          </div>
          <div className="flex items-center gap-2">
            {EVENT_COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => setColor(c.id)}
                className={`w-8 h-8 rounded-full ${c.bg} transition-all ${
                  color === c.id ? `ring-2 ring-offset-2 ring-offset-slate-900 ${COLOR_RING[c.id]} scale-110` : 'opacity-60 hover:opacity-90'
                } flex items-center justify-center`}
              >
                {color === c.id && <Check size={14} className="text-white stroke-[3]" />}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
            <Repeat size={13} className="text-slate-400" />
            <span>التكرار</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {REPEAT_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setRepeat(opt.id)}
                className={`py-1.5 rounded-xl border text-[11px] transition-all ${
                  repeat === opt.id
                    ? 'bg-sky-500/15 border-sky-500 text-sky-300 font-bold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {event && onDelete && (
          <div className="pt-2">
            {!showDelete ? (
              <button
                onClick={() => setShowDelete(true)}
                className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 size={14} />
                <span>حذف الحدث</span>
              </button>
            ) : (
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
                    onClick={() => setShowDelete(false)}
                    className="flex-1 bg-slate-800 text-slate-300 py-2 rounded-xl text-xs"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
