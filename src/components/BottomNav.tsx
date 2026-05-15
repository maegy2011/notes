import React from 'react';
import { FileText, Star, Archive, Trash2, Settings, CalendarDays, ListTodo, ShoppingCart } from 'lucide-react';
import { TabType } from '../types';

interface BottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  favoritesCount: number;
  archiveCount: number;
  trashCount: number;
  calendarCount: number;
  tasksCount: number;
  shoppingCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  favoritesCount,
  archiveCount,
  trashCount,
  calendarCount,
  tasksCount,
  shoppingCount
}) => {
  const tabs = [
    { id: 'notes' as TabType, label: 'الملاحظات', icon: FileText },
    { id: 'tasks' as TabType, label: 'المهام', icon: ListTodo, count: tasksCount },
    { id: 'shopping' as TabType, label: 'التسوق', icon: ShoppingCart, count: shoppingCount },
    { id: 'calendar' as TabType, label: 'التقويم', icon: CalendarDays, count: calendarCount },
    { id: 'favorites' as TabType, label: 'المفضلة', icon: Star, count: favoritesCount },
    { id: 'archive' as TabType, label: 'الأرشيف', icon: Archive, count: archiveCount },
    { id: 'trash' as TabType, label: 'المهملات', icon: Trash2, count: trashCount },
    { id: 'settings' as TabType, label: 'الإعدادات', icon: Settings }
  ];

  return (
    <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/80 z-20 px-2 py-2 select-none">
      <div className="flex items-center justify-around max-w-2xl mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 relative rounded-xl transition-all ${
                isActive ? 'text-amber-400 font-medium' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <div className="relative">
                <Icon size={20} className={isActive ? 'fill-amber-400/20 stroke-[2.2]' : 'stroke-[1.8]'} />
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="absolute -top-1 -left-2 bg-amber-500 text-slate-950 text-[9px] font-bold px-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center">
                    {tab.count}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-amber-500 rounded-full animate-fadeIn" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
