import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Note, NoteCategory, NoteColor } from '../types';
import { CATEGORY_LABELS, COLOR_CLASSES } from '../data/initialNotes';
import {
  Search, X, Filter, Tag, Palette, Star, Pin, Archive,
  SortAsc, SortDesc, Calendar, Sparkles,
  Trash2, CheckSquare, History, Zap, ArrowRight
} from 'lucide-react';

export interface SearchFilters {
  query: string;
  categories: NoteCategory[];
  colors: NoteColor[];
  hasChecklist: boolean | null;
  isPinned: boolean | null;
  isFavorite: boolean | null;
  isArchived: boolean | null;
  dateFrom: string;
  dateTo: string;
  sortBy: 'updatedAt' | 'createdAt' | 'title' | 'color' | 'reminder';
  sortOrder: 'asc' | 'desc';
}

interface AdvancedSearchProps {
  notes: Note[];
  isOpen: boolean;
  onClose: () => void;
  onResultsChange: (results: Note[], filters: SearchFilters) => void;
  initialFilters?: SearchFilters;
}

const RECENT_SEARCHES_KEY = 'notes_recent_searches_v1';

const defaultFilters: SearchFilters = {
  query: '',
  categories: [],
  colors: [],
  hasChecklist: null,
  isPinned: null,
  isFavorite: null,
  isArchived: null,
  dateFrom: '',
  dateTo: '',
  sortBy: 'updatedAt',
  sortOrder: 'desc'
};

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  notes,
  isOpen,
  onClose,
  onResultsChange,
  initialFilters
}) => {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters || defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Extract unique words from all notes for suggestions
  const allWords = useMemo(() => {
    const wordSet = new Set<string>();
    notes.forEach(note => {
      const text = `${note.title} ${note.content} ${note.checklist?.map(c => c.text).join(' ') || ''}`;
      text.split(/[\s\n،.،]+/).forEach(word => {
        const cleaned = word.trim();
        if (cleaned.length > 2) {
          wordSet.add(cleaned);
        }
      });
    });
    return Array.from(wordSet);
  }, [notes]);

  // Generate suggestions based on input
  useEffect(() => {
    if (filters.query.length >= 2) {
      const queryLower = filters.query.toLowerCase();
      const matched = allWords
        .filter(word => word.toLowerCase().includes(queryLower) && word.toLowerCase() !== queryLower)
        .slice(0, 5);
      setSuggestions(matched);
      setShowSuggestions(matched.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [filters.query, allWords]);

  // Save recent searches
  const saveToRecent = (query: string) => {
    if (!query.trim()) return;
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 8);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  // Filter and sort notes
  const filteredResults = useMemo(() => {
    let results = [...notes];

    // Text search
    if (filters.query.trim()) {
      const queryLower = filters.query.toLowerCase();
      results = results.filter(note => {
        const titleMatch = note.title.toLowerCase().includes(queryLower);
        const contentMatch = note.content.toLowerCase().includes(queryLower);
        const checklistMatch = note.checklist?.some(c =>
          c.text.toLowerCase().includes(queryLower) ||
          (c.reminderAt ? new Date(c.reminderAt).toLocaleString('ar-EG').toLowerCase().includes(queryLower) : false)
        );
        const categoryMatch = (CATEGORY_LABELS[note.category] || '').toLowerCase().includes(queryLower);
        const reminderMatch = note.reminder
          ? [
              note.reminder.type,
              note.reminder.location || '',
              note.reminder.note || '',
              new Date(note.reminder.datetime).toLocaleString('ar-EG')
            ].join(' ').toLowerCase().includes(queryLower)
          : false;
        return titleMatch || contentMatch || checklistMatch || categoryMatch || reminderMatch;
      });
    }

    // Category filter
    if (filters.categories.length > 0) {
      results = results.filter(note => filters.categories.includes(note.category));
    }

    // Color filter
    if (filters.colors.length > 0) {
      results = results.filter(note => filters.colors.includes(note.color));
    }

    // Checklist filter
    if (filters.hasChecklist !== null) {
      results = results.filter(note => {
        const hasList = note.checklist && note.checklist.length > 0;
        return filters.hasChecklist ? hasList : !hasList;
      });
    }

    // Pinned filter
    if (filters.isPinned !== null) {
      results = results.filter(note => note.isPinned === filters.isPinned);
    }

    // Favorite filter
    if (filters.isFavorite !== null) {
      results = results.filter(note => note.isFavorite === filters.isFavorite);
    }

    // Archived filter
    if (filters.isArchived !== null) {
      results = results.filter(note => note.isArchived === filters.isArchived);
    }

    // Date range filter
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      results = results.filter(note => new Date(note.updatedAt) >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      results = results.filter(note => new Date(note.updatedAt) <= toDate);
    }

    // Sorting
    results.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title, 'ar');
          break;
        case 'color':
          comparison = a.color.localeCompare(b.color);
          break;
        case 'reminder':
          const timeA = a.reminder?.datetime ? new Date(a.reminder.datetime).getTime() : 0;
          const timeB = b.reminder?.datetime ? new Date(b.reminder.datetime).getTime() : 0;
          comparison = timeA - timeB;
          break;
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return results;
  }, [notes, filters]);

  // Notify parent of results change
  useEffect(() => {
    onResultsChange(filteredResults, filters);
  }, [filteredResults, filters, onResultsChange]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  // تنظيف المدخلات من الأحرف الخطرة
  const sanitized = e.target.value.slice(0, 500).replace(/[\x00-\x1F\x7F]/g, '');
  setFilters(prev => ({ ...prev, query: sanitized }));
  };

  const handleSearch = (query?: string) => {
    const q = query || filters.query;
    if (q.trim()) {
      saveToRecent(q.trim());
    }
    setShowSuggestions(false);
  };

  const selectSuggestion = (word: string) => {
    setFilters(prev => ({ ...prev, query: word }));
    handleSearch(word);
    setShowSuggestions(false);
  };

  const toggleCategory = (cat: NoteCategory) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat]
    }));
  };

  const toggleColor = (color: NoteColor) => {
    setFilters(prev => ({
      ...prev,
      colors: prev.colors.includes(color)
        ? prev.colors.filter(c => c !== color)
        : [...prev.colors, color]
    }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setShowFilters(false);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.categories.length > 0) count++;
    if (filters.colors.length > 0) count++;
    if (filters.hasChecklist !== null) count++;
    if (filters.isPinned !== null) count++;
    if (filters.isFavorite !== null) count++;
    if (filters.isArchived !== null) count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.sortBy !== 'updatedAt' || filters.sortOrder !== 'desc') count++;
    return count;
  }, [filters]);

  const categories: NoteCategory[] = ['work', 'personal', 'ideas', 'study'];
  const colors: NoteColor[] = ['amber', 'emerald', 'sky', 'rose', 'purple', 'slate'];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/98 z-40 flex flex-col animate-slideUp select-none">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ArrowRight size={20} />
          </button>

          <div className="flex-1 relative" ref={suggestionsRef}>
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              ref={inputRef}
              type="text"
              value={filters.query}
              onChange={handleQueryChange}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              onFocus={() => filters.query.length >= 2 && setSuggestions(suggestions)}
              placeholder="ابحث في الملاحظات، المحتوى، والمهام..."
              className="w-full bg-slate-800 text-white text-sm rounded-xl pl-4 pr-10 py-2.5 border border-slate-700 focus:outline-none focus:border-amber-500/60 placeholder:text-slate-500 transition-all"
            />
            {filters.query && (
              <button
                onClick={() => setFilters(prev => ({ ...prev, query: '' }))}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl z-50">
                {suggestions.map((word, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectSuggestion(word)}
                    className="w-full text-right px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2 transition-colors"
                  >
                    <Zap size={12} className="text-amber-400" />
                    <span>{word}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-all relative ${
              showFilters ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Filter size={14} />
            <span className="hidden sm:inline">فلاتر</span>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -left-1 w-4 h-4 bg-rose-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Recent Searches */}
      {!filters.query && recentSearches.length > 0 && !showFilters && (
        <div className="px-4 py-3 border-b border-slate-800/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
              <History size={11} />
              عمليات البحث الأخيرة
            </span>
            <button
              onClick={clearRecentSearches}
              className="text-[10px] text-slate-600 hover:text-rose-400 flex items-center gap-0.5"
            >
              <Trash2 size={10} />
              مسح
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recentSearches.map((search, idx) => (
              <button
                key={idx}
                onClick={() => selectSuggestion(search)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700/50 transition-colors"
              >
                {search}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 border-b border-slate-800">
          {/* Categories Filter */}
          <div>
            <label className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-2">
              <Tag size={11} />
              <span>الفئات</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                    filters.categories.includes(cat)
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Colors Filter */}
          <div>
            <label className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-2">
              <Palette size={11} />
              <span>الألوان</span>
            </label>
            <div className="flex gap-2">
              {colors.map(color => {
                let bg = 'bg-slate-600';
                if (color === 'amber') bg = 'bg-amber-500';
                if (color === 'emerald') bg = 'bg-emerald-500';
                if (color === 'sky') bg = 'bg-sky-500';
                if (color === 'rose') bg = 'bg-rose-500';
                if (color === 'purple') bg = 'bg-purple-500';

                return (
                  <button
                    key={color}
                    onClick={() => toggleColor(color)}
                    className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center transition-all ${
                      filters.colors.includes(color) ? 'ring-2 ring-white scale-110' : 'opacity-50 hover:opacity-80'
                    }`}
                  >
                    {filters.colors.includes(color) && <CheckSquare size={12} className="text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Filters */}
          <div>
            <label className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-2">
              <Star size={11} />
              <span>الحالة</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'isPinned', label: '📌 مثبتة', icon: Pin },
                { key: 'isFavorite', label: '⭐ مفضلة', icon: Star },
                { key: 'hasChecklist', label: '☑️ لها قائمة مهام', icon: CheckSquare }
              ].map(({ key, label }) => {
                const currentVal = filters[key as keyof SearchFilters] as boolean | null;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      let newVal: boolean | null;
                      if (currentVal === null) newVal = true;
                      else if (currentVal === true) newVal = false;
                      else newVal = null;
                      setFilters(prev => ({ ...prev, [key]: newVal }));
                    }}
                    className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all ${
                      currentVal === true
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : currentVal === false
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    {label}
                    {currentVal === true && ' ✓'}
                    {currentVal === false && ' ✗'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-2">
              <Calendar size={11} />
              <span>نطاق التاريخ</span>
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="w-full bg-slate-800 text-slate-200 text-[11px] rounded-lg px-2 py-1.5 border border-slate-700 focus:outline-none focus:border-amber-500/60"
                />
                <span className="text-[9px] text-slate-600 mt-0.5 block">من تاريخ</span>
              </div>
              <div className="flex-1">
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="w-full bg-slate-800 text-slate-200 text-[11px] rounded-lg px-2 py-1.5 border border-slate-700 focus:outline-none focus:border-amber-500/60"
                />
                <span className="text-[9px] text-slate-600 mt-0.5 block">إلى تاريخ</span>
              </div>
            </div>
          </div>

          {/* Sort Options */}
          <div>
            <label className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mb-2">
              {filters.sortOrder === 'asc' ? <SortAsc size={11} /> : <SortDesc size={11} />}
              <span>الترتيب</span>
            </label>
            <div className="flex gap-2">
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as SearchFilters['sortBy'] }))}
                className="flex-1 bg-slate-800 text-slate-200 text-[11px] rounded-lg px-2 py-2 border border-slate-700 focus:outline-none"
              >
                <option value="updatedAt">تاريخ التعديل</option>
                <option value="createdAt">تاريخ الإنشاء</option>
                <option value="title">أبجدياً (العنوان)</option>
                <option value="color">حسب اللون</option>
                <option value="reminder">وقت التذكير</option>
              </select>
              <button
                onClick={() => setFilters(prev => ({
                  ...prev,
                  sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
                }))}
                className="bg-slate-800 text-slate-400 hover:text-white px-3 rounded-lg border border-slate-700 flex items-center justify-center transition-colors"
              >
                {filters.sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
              </button>
            </div>
          </div>

          {/* Reset Filters */}
          <button
            onClick={resetFilters}
            className="w-full bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-rose-400 py-2 rounded-xl text-xs border border-slate-700/50 flex items-center justify-center gap-1.5 transition-colors"
          >
            <X size={12} />
            <span>مسح جميع الفلاتر</span>
          </button>
        </div>
      )}

      {/* Results Summary & Close */}
      <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-amber-400" />
          <span className="text-xs text-slate-300">
            <span className="font-bold text-amber-400">{filteredResults.length}</span> نتيجة
            {filters.query && <span className="text-slate-500"> لـ "{filters.query}"</span>}
          </span>
        </div>
        {activeFiltersCount > 0 && (
          <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full">
            {activeFiltersCount} فلتر نشط
          </span>
        )}
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filteredResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-600 mb-3">
              <Search size={28} />
            </div>
            <h3 className="text-sm font-bold text-slate-300 mb-1">لا توجد نتائج</h3>
            <p className="text-xs text-slate-500 max-w-xs">
              جرّب تغيير كلمات البحث أو تعديل الفلاتر للحصول على نتائج أفضل
            </p>
          </div>
        ) : (
          filteredResults.map(note => {
            const colorStyle = COLOR_CLASSES[note.color] || COLOR_CLASSES.slate;
            const checklistDone = note.checklist?.filter(c => c.completed).length || 0;
            const checklistTotal = note.checklist?.length || 0;

            return (
              <div
                key={note.id}
                className={`p-3 rounded-xl border ${colorStyle.bg} ${colorStyle.border} cursor-pointer`}
                onClick={() => {
                  onClose();
                  setTimeout(() => {
                    const event = new CustomEvent('selectNote', { detail: note.id });
                    window.dispatchEvent(event);
                  }, 200);
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="text-xs font-bold text-white line-clamp-1 flex-1">
                    {note.title}
                  </h4>
                  <div className="flex items-center gap-1 shrink-0">
                    {note.isPinned && <Pin size={10} className="text-amber-400 rotate-45" />}
                    {note.isFavorite && <Star size={10} className="text-amber-400 fill-amber-400" />}
                    {note.isArchived && <Archive size={10} className="text-slate-500" />}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 mb-1.5">{note.content || 'فارغة'}</p>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span className={`px-1.5 py-0.5 rounded ${colorStyle.badgeBg} ${colorStyle.badgeText}`}>
                    {CATEGORY_LABELS[note.category]}
                  </span>
                  <div className="flex items-center gap-2">
                    {checklistTotal > 0 && (
                      <span className="flex items-center gap-0.5">
                        <CheckSquare size={10} />
                        {checklistDone}/{checklistTotal}
                      </span>
                    )}
                    <span>
                      {new Date(note.updatedAt).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
