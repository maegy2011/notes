import React, { useState, useRef, useEffect } from 'react';
import { Plus, FileText, ListTodo, CalendarClock, ShoppingCart, X } from 'lucide-react';
import { TabType } from '../types';

interface EnhancedFABProps {
  activeTab: TabType;
  onAddNote: () => void;
  onAddTask: () => void;
  onAddEvent: () => void;
  onAddShoppingList: () => void;
}

export const EnhancedFAB: React.FC<EnhancedFABProps> = ({
  activeTab,
  onAddNote,
  onAddTask,
  onAddEvent,
  onAddShoppingList,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  const actions = [
    {
      id: 'notes',
      label: 'ملاحظة جديدة',
      icon: FileText,
      color: 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20',
      onClick: onAddNote,
    },
    {
      id: 'tasks',
      label: 'مهمة جديدة',
      icon: ListTodo,
      color: 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20',
      onClick: onAddTask,
    },
    {
      id: 'calendar',
      label: 'حدث جديد',
      icon: CalendarClock,
      color: 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/20',
      onClick: onAddEvent,
    },
    {
      id: 'shopping',
      label: 'قائمة تسوق',
      icon: ShoppingCart,
      color: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20',
      onClick: onAddShoppingList,
    },
  ];

  // Don't display FAB in settings tab since settings doesn't support additions
  if (activeTab === 'settings') return null;

  return (
    <div className="fixed bottom-20 left-6 z-30 flex flex-col items-center" ref={menuRef}>
      {/* Action Menu Items (Slide-up) */}
      {isOpen && (
        <div className="flex flex-col items-center gap-2.5 mb-3 animate-slideUp select-none">
          {actions.map((act) => {
            const Icon = act.icon;
            const isCurrentTab = activeTab === act.id;
            return (
              <button
                key={act.id}
                onClick={() => handleAction(act.onClick)}
                className={`flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl shadow-lg border border-slate-800 transition-all active:scale-95 hover:scale-[1.03] ${
                  isCurrentTab 
                    ? 'bg-slate-950 text-amber-400 font-bold ring-1 ring-amber-500/30 scale-105' 
                    : 'bg-slate-900 text-slate-300'
                }`}
                type="button"
              >
                <span className="text-[10px] font-bold">{act.label}</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${act.color} shadow-sm`}>
                  <Icon size={14} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Central Primary Expandable Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl shadow-amber-500/20 transition-all duration-300 active:scale-90 ${
          isOpen 
            ? 'bg-rose-500 text-white rotate-90 hover:bg-rose-400' 
            : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
        }`}
        aria-label={isOpen ? 'إغلاق القائمة' : 'إضافة عنصر جديد'}
        type="button"
      >
        {isOpen ? (
          <X size={24} className="stroke-[2.5]" />
        ) : (
          <Plus size={26} className="stroke-[2.5]" />
        )}
      </button>
    </div>
  );
};
