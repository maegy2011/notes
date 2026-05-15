import React, { useState } from 'react';
import { Sparkles, Search, Bell, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

interface MobileHeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeCount: number;
  onOpenAdvancedSearch: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  searchQuery,
  setSearchQuery,
  activeCount,
  onOpenAdvancedSearch
}) => {
  const [showSearchInput, setShowSearchInput] = useState(false);

  return (
    <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-20 px-4 py-3 select-none">
      {/* Main Title bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center shadow-md shadow-amber-500/10">
            <Sparkles size={20} className="text-slate-950" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              ملاحظاتي
              <span className="text-[10px] bg-slate-800 text-amber-400 px-2 py-0.5 rounded-full font-normal border border-slate-700/60">
                {activeCount} نشطة
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 -mt-0.5 font-light">إدارة ملاحظاتك بذكاء</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAdvancedSearch}
            className="w-10 h-10 rounded-xl bg-slate-800 text-amber-400 hover:bg-slate-700 flex items-center justify-center transition-all relative"
            aria-label="بحث متقدم"
          >
            <SlidersHorizontal size={18} />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
          </button>

          <button
            onClick={() => {
              const event = new CustomEvent('toggleSortMenu');
              window.dispatchEvent(event);
            }}
            className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center transition-all"
            aria-label="ترتيب"
          >
            <ArrowUpDown size={18} />
          </button>

          <button
            onClick={() => {
              setShowSearchInput(!showSearchInput);
              if (showSearchInput && searchQuery) {
                setSearchQuery('');
              }
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              showSearchInput || searchQuery ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            aria-label="بحث سريع"
          >
            <Search size={18} />
          </button>
          
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center cursor-default">
              <Bell size={18} />
              <span className="absolute top-2 left-2 w-2 h-2 bg-rose-500 rounded-full"></span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Search Input */}
      {(showSearchInput || searchQuery) && (
        <div className="mt-3 animate-fadeIn transition-all">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث سريع في الملاحظات..."
              className="w-full bg-slate-800/90 text-slate-100 text-sm rounded-xl pl-12 pr-10 py-2.5 border border-slate-700/80 focus:outline-none focus:border-amber-500/60 placeholder:text-slate-500 transition-all"
              autoFocus
            />
            <Search size={14} className="absolute right-3 top-3.5 text-slate-500 pointer-events-none" />
            <button
              onClick={onOpenAdvancedSearch}
              className="absolute left-2 top-1.5 text-[10px] text-amber-400 hover:text-white bg-slate-700 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
            >
              <SlidersHorizontal size={10} />
              <span>متقدم</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
