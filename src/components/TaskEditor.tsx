import React, { useState, useEffect } from 'react';
import { AppTask, TaskPriority, TaskCategory, TaskColor } from '../types';
import {
  ArrowRight, Check, Trash2, AlertTriangle,
  Tag, Palette, AlignLeft, Calendar
} from 'lucide-react';

interface TaskEditorProps {
  task: AppTask | null; // null = create new
  onSave: (taskData: Omit<AppTask, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  showToast: (msg: string) => void;
}

const TASK_CATEGORIES: { id: TaskCategory; label: string; emoji: string }[] = [
  { id: 'work', label: 'عمل', emoji: '💻' },
  { id: 'personal', label: 'شخصي', emoji: '🙍' },
  { id: 'study', label: 'دراسة', emoji: '📚' },
  { id: 'shopping', label: 'تسوق', emoji: '🛒' },
  { id: 'other', label: 'أخرى', emoji: '📌' },
];

const TASK_PRIORITIES: { id: TaskPriority; label: string; colorClass: string }[] = [
  { id: 'high', label: 'مرتفعة', colorClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  { id: 'medium', label: 'متوسطة', colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { id: 'low', label: 'منخفضة', colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
];

const TASK_COLORS: { id: TaskColor; bg: string; label: string }[] = [
  { id: 'amber', bg: 'bg-amber-500', label: 'كهرماني' },
  { id: 'emerald', bg: 'bg-emerald-500', label: 'أخضر' },
  { id: 'sky', bg: 'bg-sky-500', label: 'سماوي' },
  { id: 'rose', bg: 'bg-rose-500', label: 'وردي' },
  { id: 'purple', bg: 'bg-purple-500', label: 'بنفسجي' },
  { id: 'slate', bg: 'bg-slate-500', label: 'رمادي' },
];

const COLOR_RING: Record<TaskColor, string> = {
  amber: 'ring-amber-500',
  emerald: 'ring-emerald-500',
  sky: 'ring-sky-500',
  rose: 'ring-rose-500',
  purple: 'ring-purple-500',
  slate: 'ring-slate-400',
};

const toLocalInput = (iso?: string) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
  } catch { return ''; }
};

const fromLocalInput = (val: string): string | undefined => {
  if (!val) return undefined;
  return new Date(val).toISOString();
};

export const TaskEditor: React.FC<TaskEditorProps> = ({
  task, onSave, onDelete, onClose, showToast
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [category, setCategory] = useState<TaskCategory>('personal');
  const [color, setColor] = useState<TaskColor>('amber');
  const [dueDateInput, setDueDateInput] = useState('');
  const [reminderAtInput, setReminderAtInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setPriority(task.priority);
      setCategory(task.category);
      setColor(task.color);
      setDueDateInput(toLocalInput(task.dueDate));
      setReminderAtInput(toLocalInput(task.reminderAt));
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setCategory('personal');
      setColor('amber');
      setDueDateInput('');
      setReminderAtInput('');
    }
  }, [task]);

  const handleSave = () => {
    if (!title.trim()) {
      showToast('يرجى إدخال عنوان المهمة');
      return;
    }

    onSave({
      id: task?.id,
      title: title.trim(),
      description: description.trim(),
      priority,
      category,
      color,
      dueDate: fromLocalInput(dueDateInput),
      reminderAt: fromLocalInput(reminderAtInput),
      isCompleted: task?.isCompleted ?? false,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-40 flex flex-col animate-slideUp overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-slate-400 hover:text-white py-1 pr-1 pl-3 rounded-lg bg-slate-800/60"
        >
          <ArrowRight size={18} />
          <span className="text-xs">رجوع</span>
        </button>

        <span className="text-xs font-bold text-slate-200">
          {task ? 'تعديل المهمة' : 'مهمة جديدة'}
        </span>

        <button
          onClick={handleSave}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1"
        >
          <Check size={14} className="stroke-[2.5]" />
          <span>حفظ</span>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Color strip */}
        <div className={`h-1.5 rounded-full ${TASK_COLORS.find(c => c.id === color)?.bg ?? 'bg-amber-500'}`} />

        {/* Title input */}
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="عنوان المهمة..."
          className="w-full bg-transparent text-white text-base font-bold placeholder:text-slate-600 border-b border-slate-800 pb-2 focus:outline-none focus:border-amber-500/60 transition-colors"
        />

        {/* Priority Selection */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
            <AlertTriangle size={13} className="text-rose-400" />
            <span>درجة الأهمية (الأولوية)</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TASK_PRIORITIES.map(p => {
              const active = priority === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPriority(p.id)}
                  className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                    active ? p.colorClass + ' border-current scale-[1.02]' : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Due Date & Reminder */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-3 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold mb-1">
            <Calendar size={13} className="text-amber-400" />
            <span>التواريخ والتذكير</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">تاريخ الاستحقاق</label>
              <input
                type="datetime-local"
                value={dueDateInput}
                onChange={e => setDueDateInput(e.target.value)}
                className="w-full bg-slate-950 text-slate-100 text-[11px] rounded-xl px-2.5 py-2 border border-slate-800 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 block mb-1">وقت التذكير</label>
              <input
                type="datetime-local"
                value={reminderAtInput}
                onChange={e => setReminderAtInput(e.target.value)}
                className="w-full bg-slate-950 text-slate-100 text-[11px] rounded-xl px-2.5 py-2 border border-slate-800 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
            <AlignLeft size={13} className="text-slate-400" />
            <span>وصف المهمة</span>
          </div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="أضف أي ملاحظات أو تفاصيل إضافية للمهمة..."
            className="w-full bg-slate-950 text-slate-100 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed placeholder:text-slate-600"
          />
        </div>

        {/* Category Picker */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
            <Tag size={13} className="text-slate-400" />
            <span>التصنيف</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {TASK_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`py-2 px-1.5 rounded-xl border text-xs flex flex-col items-center gap-1 transition-all ${
                  category === cat.id
                    ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="text-base">{cat.emoji}</span>
                <span className="text-[10px]">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Color Picker */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
            <Palette size={13} className="text-slate-400" />
            <span>لون شريط التمييز</span>
          </div>
          <div className="flex items-center gap-2">
            {TASK_COLORS.map(c => (
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

        {/* Delete Button for editing mode */}
        {task && onDelete && (
          <div className="pt-2">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 size={14} />
                <span>حذف المهمة نهائياً</span>
              </button>
            ) : (
              <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-3 space-y-2.5">
                <p className="text-xs text-rose-200 text-center">هل أنت متأكد من حذف هذه المهمة نهائياً؟</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { onDelete(task.id); onClose(); }}
                    className="flex-1 bg-rose-500 hover:bg-rose-400 text-white py-2 rounded-xl text-xs font-bold"
                  >
                    نعم، احذف
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
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
