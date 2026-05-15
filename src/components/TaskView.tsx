import React, { useState, useMemo } from 'react';
import { AppTask, TaskPriority, TaskCategory } from '../types';
import {
  Calendar, Bell, CheckCircle2, Circle,
  ListTodo, Trash2, Edit3, Search, ArrowUpDown, Share2, CopyPlus,
} from 'lucide-react';

interface TaskViewProps {
  tasks: AppTask[];
  onEditTask: (task: AppTask) => void;
  onToggleComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onShareTask?: (task: AppTask) => void;
  onDuplicateTask?: (task: AppTask) => void;
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: '🔴 مرتفعة',
  medium: '🟡 متوسطة',
  low: '🟢 منخفضة',
};

const PRIORITY_BG: Record<TaskPriority, string> = {
  high: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  work: '💻 عمل',
  personal: '🙍 شخصي',
  study: '📚 دراسة',
  shopping: '🛒 تسوق',
  other: '📌 أخرى',
};

export const TaskView: React.FC<TaskViewProps> = ({
  tasks, onEditTask, onToggleComplete, onDeleteTask, onShareTask, onDuplicateTask
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'createdAt'>('dueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showCompleted, setShowCompleted] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Filter and Sort Tasks
  const processedTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      const query = searchQuery.toLowerCase();
      const matchText = task.title.toLowerCase().includes(query) || task.description.toLowerCase().includes(query);
      const matchPriority = filterPriority === 'all' || task.priority === filterPriority;
      const matchCategory = filterCategory === 'all' || task.category === filterCategory;
      const matchStatus = showCompleted || !task.isCompleted;

      return matchText && matchPriority && matchCategory && matchStatus;
    });

    // Sorting
    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'dueDate') {
        const timeA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const timeB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        comparison = timeA - timeB;
      } else if (sortBy === 'priority') {
        const val: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 };
        comparison = val[b.priority] - val[a.priority];
      } else {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [tasks, searchQuery, filterPriority, filterCategory, sortBy, sortOrder, showCompleted]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.isCompleted).length;
    const high = tasks.filter(t => !t.isCompleted && t.priority === 'high').length;
    return { total, completed, pending: total - completed, high };
  }, [tasks]);

  const formatDT = (iso?: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('ar-EG', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    });
  };

  const isOverdue = (task: AppTask) => {
    if (task.isCompleted || !task.dueDate) return false;
    return new Date(task.dueDate) < new Date();
  };

  return (
    <div className="p-4 space-y-4 pb-20 animate-fadeIn select-none">
      {/* Title and FAB */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo size={18} className="text-amber-500" />
            <h2 className="text-sm font-bold text-white">إدارة المهام والـ To-Do</h2>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800">
            <div className="text-[9px] text-slate-400 mb-0.5">المجموع</div>
            <div className="text-xs font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800">
            <div className="text-[9px] text-slate-400 mb-0.5">المنجزة</div>
            <div className="text-xs font-bold text-emerald-400">{stats.completed}</div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800">
            <div className="text-[9px] text-slate-400 mb-0.5">العاجلة 🔴</div>
            <div className="text-xs font-bold text-rose-400">{stats.high}</div>
          </div>
        </div>
      </div>

      {/* Search and Quick Filters */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-3 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute right-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="البحث في المهام والـ To-Do..."
            className="w-full bg-slate-950 text-slate-100 text-xs rounded-xl pr-9 pl-3 py-2 border border-slate-800 focus:outline-none focus:border-amber-500/50 placeholder:text-slate-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">فلترة بالأولوية</label>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="w-full bg-slate-950 text-slate-300 text-[11px] rounded-xl px-2 py-1.5 border border-slate-800 focus:outline-none"
            >
              <option value="all">كل الأولويات</option>
              <option value="high">🔴 مرتفعة</option>
              <option value="medium">🟡 متوسطة</option>
              <option value="low">🟢 منخفضة</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">فلترة بالتصنيف</label>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="w-full bg-slate-950 text-slate-300 text-[11px] rounded-xl px-2 py-1.5 border border-slate-800 focus:outline-none"
            >
              <option value="all">كل التصنيفات</option>
              <option value="work">💻 عمل</option>
              <option value="personal">🙍 شخصي</option>
              <option value="study">📚 دراسة</option>
              <option value="shopping">🛒 تسوق</option>
              <option value="other">📌 أخرى</option>
            </select>
          </div>
        </div>

        {/* Sorting */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <ArrowUpDown size={11} />
            <span>الترتيب حسب:</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-slate-950 text-slate-300 text-[10px] rounded-lg px-2 py-1 border border-slate-800 focus:outline-none"
            >
              <option value="dueDate">تاريخ الاستحقاق</option>
              <option value="priority">الأهمية</option>
              <option value="createdAt">تاريخ الإنشاء</option>
            </select>
            <button
              onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')}
              className="p-1 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-lg"
            >
              <ArrowUpDown size={12} className={sortOrder === 'asc' ? 'rotate-180' : ''} />
            </button>
          </div>
        </div>

        {/* Hide/Show Completed */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-slate-400">إظهار المهام المنجزة</span>
          <button
            onClick={() => setShowCompleted(p => !p)}
            className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${showCompleted ? 'bg-amber-500' : 'bg-slate-800'}`}
          >
            <div className={`w-4 h-4 bg-slate-950 rounded-full shadow transition-transform ${showCompleted ? 'translate-x-0' : '-translate-x-4'}`} />
          </button>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-2">
        {processedTasks.length === 0 ? (
          <div className="text-center py-16 text-slate-600 bg-slate-900/20 rounded-2xl border border-slate-800/30">
            <ListTodo size={32} className="mx-auto mb-2 opacity-30 text-slate-500" />
            <h3 className="text-xs font-bold text-slate-400">لا توجد مهام مطابقة</h3>
            <p className="text-[11px] text-slate-500 mt-1">أضف مهام جديدة بالضغط على زر (+) العائم بالأسفل</p>
          </div>
        ) : (
          processedTasks.map(task => {
            const isExpanded = expandedTaskId === task.id;
            const overdue = isOverdue(task);

            return (
              <div
                key={task.id}
                className={`bg-slate-900/40 border border-slate-800 rounded-2xl p-3 space-y-2.5 transition-all relative ${
                  task.isCompleted ? 'opacity-60' : ''
                }`}
              >
                {/* Left priority stripe */}
                <div className={`absolute top-0 left-0 bottom-0 w-1 rounded-l-2xl ${
                  task.priority === 'high' ? 'bg-rose-500' : task.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                }`} />

                <div className="flex items-start gap-2.5 pl-1 pr-2">
                  {/* Checkbox */}
                  <button
                    onClick={() => onToggleComplete(task.id)}
                    className={`mt-0.5 transition-transform active:scale-90 shrink-0 ${
                      task.isCompleted ? 'text-emerald-400' : 'text-slate-600 hover:text-amber-500'
                    }`}
                  >
                    {task.isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  </button>

                  {/* Title & snippet */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  >
                    <h3 className={`text-xs font-bold leading-snug text-white ${task.isCompleted ? 'line-through text-slate-500 font-normal' : ''}`}>
                      {task.title}
                    </h3>
                    {!isExpanded && task.description && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{task.description}</p>
                    )}
                  </div>

                  {/* Quick Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {onShareTask && (
                      <button
                        onClick={() => onShareTask(task)}
                        className="p-1 text-slate-500 hover:text-sky-400 rounded-lg"
                        title="مشاركة"
                      >
                        <Share2 size={12} />
                      </button>
                    )}
                    {onDuplicateTask && (
                      <button
                        onClick={() => onDuplicateTask(task)}
                        className="p-1 text-slate-500 hover:text-purple-400 rounded-lg"
                        title="إنشاء نسخة"
                      >
                        <CopyPlus size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => onEditTask(task)}
                      className="p-1 text-slate-500 hover:text-amber-400 rounded-lg"
                      title="تعديل"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1 text-slate-600 hover:text-rose-400 rounded-lg"
                      title="حذف"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Meta Row */}
                <div className="flex flex-wrap items-center gap-1.5 pl-1 pr-8 text-[9px]">
                  <span className={`px-1.5 py-0.5 rounded border font-bold ${PRIORITY_BG[task.priority]}`}>
                    {PRIORITY_LABEL[task.priority]}
                  </span>

                  <span className="px-1.5 py-0.5 rounded bg-slate-850 border border-slate-800 text-slate-400">
                    {CATEGORY_LABEL[task.category]}
                  </span>

                  {task.dueDate && (
                    <span className={`px-1.5 py-0.5 rounded flex items-center gap-0.5 border ${
                      overdue ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-slate-850 border-slate-800 text-slate-400'
                    }`}>
                      <Calendar size={9} />
                      <span>{formatDT(task.dueDate)}</span>
                      {overdue && <span className="font-bold mr-0.5 font-sans">متأخرة!</span>}
                    </span>
                  )}

                  {task.reminderAt && !task.isCompleted && (
                    <span className="px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-300 flex items-center gap-0.5">
                      <Bell size={9} />
                      <span>تذكير: {formatDT(task.reminderAt)}</span>
                    </span>
                  )}
                </div>

                {/* Expanded Description */}
                {isExpanded && task.description && (
                  <div className="pl-1 pr-8 pt-2 border-t border-slate-850/60 text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap font-light">
                    {task.description}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
