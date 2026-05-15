import React, { useState, useMemo, useEffect } from 'react';
import { ShoppingList, ShopItem, ShopCategory, ShopItemUnit, ShopListColor } from '../types';
import {
  Plus, ShoppingCart, ShoppingBag, Search, Archive, RefreshCw,
  Trash2, Check, Edit3, X,
  DollarSign, Store, Package, CheckCircle2, Circle,
  Share2, CopyPlus,
} from 'lucide-react';

/* ─── Constants ─── */
const SHOP_CATEGORIES: { id: ShopCategory; label: string; emoji: string }[] = [
  { id: 'fruits',      label: 'فواكه',         emoji: '🍎' },
  { id: 'vegetables',  label: 'خضروات',         emoji: '🥦' },
  { id: 'meat',        label: 'لحوم ودواجن',    emoji: '🥩' },
  { id: 'dairy',       label: 'ألبان وأجبان',   emoji: '🧀' },
  { id: 'bakery',      label: 'مخبوزات',        emoji: '🥖' },
  { id: 'beverages',   label: 'مشروبات',        emoji: '🧃' },
  { id: 'frozen',      label: 'مجمدات',         emoji: '🧊' },
  { id: 'cleaning',    label: 'منظفات',         emoji: '🧹' },
  { id: 'personal',    label: 'عناية شخصية',   emoji: '🪥' },
  { id: 'electronics', label: 'إلكترونيات',     emoji: '📱' },
  { id: 'clothing',    label: 'ملابس',          emoji: '👔' },
  { id: 'pharmacy',    label: 'صيدلية',         emoji: '💊' },
  { id: 'other',       label: 'أخرى',           emoji: '📦' },
];

const SHOP_UNITS: { id: ShopItemUnit; label: string }[] = [
  { id: 'piece',  label: 'قطعة' },
  { id: 'kg',     label: 'كجم' },
  { id: 'g',      label: 'جرام' },
  { id: 'L',      label: 'لتر' },
  { id: 'ml',     label: 'مل' },
  { id: 'pack',   label: 'كيس' },
  { id: 'box',    label: 'علبة' },
  { id: 'bottle', label: 'زجاجة' },
  { id: 'dozen',  label: 'دزينة' },
  { id: 'other',  label: 'أخرى' },
];

const LIST_COLORS: { id: ShopListColor; bg: string; ring: string; chip: string }[] = [
  { id: 'amber',   bg: 'bg-amber-500',   ring: 'ring-amber-400',   chip: 'bg-amber-500/15 border-amber-500/40 text-amber-200' },
  { id: 'emerald', bg: 'bg-emerald-500', ring: 'ring-emerald-400', chip: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200' },
  { id: 'sky',     bg: 'bg-sky-500',     ring: 'ring-sky-400',     chip: 'bg-sky-500/15 border-sky-500/40 text-sky-200' },
  { id: 'rose',    bg: 'bg-rose-500',    ring: 'ring-rose-400',    chip: 'bg-rose-500/15 border-rose-500/40 text-rose-200' },
  { id: 'purple',  bg: 'bg-purple-500',  ring: 'ring-purple-400',  chip: 'bg-purple-500/15 border-purple-500/40 text-purple-200' },
  { id: 'slate',   bg: 'bg-slate-500',   ring: 'ring-slate-400',   chip: 'bg-slate-700 border-slate-600 text-slate-200' },
];

const getCatMeta = (id: ShopCategory) => SHOP_CATEGORIES.find(c => c.id === id) ?? SHOP_CATEGORIES[SHOP_CATEGORIES.length-1];
const getListColor = (id: ShopListColor) => LIST_COLORS.find(c => c.id === id) ?? LIST_COLORS[0];

const uid = () => Date.now().toString() + Math.random().toString(36).slice(2, 7);

/* ─── Props ─── */
interface ShoppingViewProps {
  lists: ShoppingList[];
  onSaveLists: (lists: ShoppingList[]) => void;
  showToast: (msg: string) => void;
  onShareList?: (list: ShoppingList) => void;
  onDuplicateList?: (listId: string) => void;
}

/* ─── Component ─── */
export const ShoppingView: React.FC<ShoppingViewProps> = ({ lists, onSaveLists, showToast, onShareList, onDuplicateList }) => {
  const [view, setView] = useState<'home' | 'detail'>('home');
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');

  useEffect(() => {
    const handleOpenNewShoppingList = () => {
      setView('home');
      setIsCreatingList(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('openNewShoppingList', handleOpenNewShoppingList);
    return () => window.removeEventListener('openNewShoppingList', handleOpenNewShoppingList);
  }, []);
  const [newListColor, setNewListColor] = useState<ShopListColor>('emerald');
  const [newListBudget, setNewListBudget] = useState('');
  const [newListStore, setNewListStore] = useState('');

  /* Active list detail states */
  const [addItemMode, setAddItemMode] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState<ShopItemUnit>('piece');
  const [newItemCat, setNewItemCat] = useState<ShopCategory>('other');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemNote, setNewItemNote] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemQty, setEditItemQty] = useState('1');
  const [editItemUnit, setEditItemUnit] = useState<ShopItemUnit>('piece');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [editItemNote, setEditItemNote] = useState('');
  const [editingListMeta, setEditingListMeta] = useState(false);
  const [editListName, setEditListName] = useState('');
  const [editListBudget, setEditListBudget] = useState('');
  const [editListStore, setEditListStore] = useState('');
  const [editListColor, setEditListColor] = useState<ShopListColor>('emerald');

  /* Derived */
  const activeList = useMemo(() => lists.find(l => l.id === activeListId) ?? null, [lists, activeListId]);

  const filteredLists = useMemo(() => {
    return lists
      .filter(l => l.isArchived === showArchived)
      .filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [lists, showArchived, searchQuery]);

  const listStats = (list: ShoppingList) => {
    const total = list.items.length;
    const done = list.items.filter(i => i.checked).length;
    const cost = list.items.filter(i => i.checked && i.price).reduce((s, i) => s + (i.price! * i.qty), 0);
    const totalCost = list.items.filter(i => i.price).reduce((s, i) => s + (i.price! * i.qty), 0);
    return { total, done, cost, totalCost };
  };

  const groupedItems = useMemo(() => {
    if (!activeList) return {};
    const items = filterCat === 'all'
      ? activeList.items
      : activeList.items.filter(i => i.category === filterCat);
    return items.reduce<Record<string, ShopItem[]>>((acc, item) => {
      const key = item.category;
      acc[key] = acc[key] ? [...acc[key], item] : [item];
      return acc;
    }, {});
  }, [activeList, filterCat]);

  /* ─── Mutators ─── */
  const updateLists = (fn: (lists: ShoppingList[]) => ShoppingList[]) => {
    onSaveLists(fn(lists));
  };

  const createList = () => {
    if (!newListName.trim()) { showToast('يرجى إدخال اسم القائمة'); return; }
    const now = new Date().toISOString();
    const newList: ShoppingList = {
      id: uid(),
      name: newListName.trim(),
      color: newListColor,
      budget: newListBudget ? parseFloat(newListBudget) : undefined,
      store: newListStore.trim() || undefined,
      items: [],
      createdAt: now,
      updatedAt: now,
      isArchived: false,
    };
    onSaveLists([newList, ...lists]);
    setIsCreatingList(false);
    setNewListName('');
    setNewListBudget('');
    setNewListStore('');
    showToast('✅ تم إنشاء القائمة الجديدة');
    setActiveListId(newList.id);
    setView('detail');
  };

  const deleteList = (id: string) => {
    updateLists(ls => ls.filter(l => l.id !== id));
    if (activeListId === id) { setView('home'); setActiveListId(null); }
    showToast('تم حذف القائمة');
  };

  const toggleArchiveList = (id: string) => {
    updateLists(ls => ls.map(l => l.id === id
      ? { ...l, isArchived: !l.isArchived, updatedAt: new Date().toISOString() }
      : l
    ));
    showToast(lists.find(l => l.id === id)?.isArchived ? 'تمت استعادة القائمة' : 'تمت أرشفة القائمة');
  };

  const saveListMeta = () => {
    if (!editListName.trim()) return;
    updateLists(ls => ls.map(l => l.id === activeListId ? {
      ...l,
      name: editListName.trim(),
      budget: editListBudget ? parseFloat(editListBudget) : undefined,
      store: editListStore.trim() || undefined,
      color: editListColor,
      updatedAt: new Date().toISOString(),
    } : l));
    setEditingListMeta(false);
    showToast('تم تحديث بيانات القائمة');
  };

  const addItem = () => {
    if (!newItemName.trim()) { showToast('يرجى إدخال اسم المنتج'); return; }
    const newItem: ShopItem = {
      id: uid(),
      name: newItemName.trim(),
      qty: parseFloat(newItemQty) || 1,
      unit: newItemUnit,
      price: newItemPrice ? parseFloat(newItemPrice) : undefined,
      category: newItemCat,
      note: newItemNote.trim() || undefined,
      checked: false,
      addedAt: new Date().toISOString(),
    };
    updateLists(ls => ls.map(l => l.id === activeListId
      ? { ...l, items: [...l.items, newItem], updatedAt: new Date().toISOString() }
      : l
    ));
    setNewItemName('');
    setNewItemQty('1');
    setNewItemPrice('');
    setNewItemNote('');
  };

  const toggleItemCheck = (itemId: string) => {
    updateLists(ls => ls.map(l => l.id === activeListId ? {
      ...l,
      items: l.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i),
      updatedAt: new Date().toISOString(),
    } : l));
  };

  const deleteItem = (itemId: string) => {
    updateLists(ls => ls.map(l => l.id === activeListId ? {
      ...l,
      items: l.items.filter(i => i.id !== itemId),
      updatedAt: new Date().toISOString(),
    } : l));
  };

  const saveEditItem = (itemId: string) => {
    if (!editItemName.trim()) return;
    updateLists(ls => ls.map(l => l.id === activeListId ? {
      ...l,
      items: l.items.map(i => i.id === itemId ? {
        ...i,
        name: editItemName.trim(),
        qty: parseFloat(editItemQty) || 1,
        unit: editItemUnit,
        price: editItemPrice ? parseFloat(editItemPrice) : undefined,
        note: editItemNote.trim() || undefined,
      } : i),
      updatedAt: new Date().toISOString(),
    } : l));
    setEditingItemId(null);
  };

  const clearChecked = () => {
    const cnt = activeList?.items.filter(i => i.checked).length ?? 0;
    updateLists(ls => ls.map(l => l.id === activeListId ? {
      ...l,
      items: l.items.filter(i => !i.checked),
      updatedAt: new Date().toISOString(),
    } : l));
    showToast(`تم حذف ${cnt} عنصر مشترى`);
  };

  const checkAll = () => {
    const allChecked = activeList?.items.every(i => i.checked);
    updateLists(ls => ls.map(l => l.id === activeListId ? {
      ...l,
      items: l.items.map(i => ({ ...i, checked: !allChecked })),
      updatedAt: new Date().toISOString(),
    } : l));
  };

  /* ─── Home View ─── */
  const renderHome = () => (
    <div className="p-4 space-y-4 pb-20 animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-emerald-400" />
            <h2 className="text-sm font-bold text-white">قوائم التسوق</h2>
          </div>
          <button
            onClick={() => setIsCreatingList(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all active:scale-95"
          >
            <Plus size={14} />
            <span>قائمة جديدة</span>
          </button>
        </div>

        {/* Total stats */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2 text-center">
            <div className="text-[9px] text-slate-400">القوائم</div>
            <div className="text-xs font-bold text-white">{lists.filter(l => !l.isArchived).length}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2 text-center">
            <div className="text-[9px] text-slate-400">المنتجات</div>
            <div className="text-xs font-bold text-emerald-400">{lists.filter(l => !l.isArchived).reduce((s, l) => s + l.items.length, 0)}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2 text-center">
            <div className="text-[9px] text-slate-400">تم الشراء</div>
            <div className="text-xs font-bold text-amber-400">{lists.filter(l => !l.isArchived).reduce((s, l) => s + l.items.filter(i => i.checked).length, 0)}</div>
          </div>
        </div>
      </div>

      {/* Search and archive toggle */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute right-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ابحث في القوائم..."
            className="w-full bg-slate-900/60 text-slate-100 text-xs rounded-xl pr-9 pl-3 py-2 border border-slate-800 focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600"
          />
        </div>
        <button
          onClick={() => setShowArchived(p => !p)}
          className={`px-3 py-2 rounded-xl border text-xs flex items-center gap-1 transition-all ${
            showArchived ? 'bg-amber-500/15 border-amber-500 text-amber-400' : 'bg-slate-900/60 border-slate-800 text-slate-400'
          }`}
        >
          <Archive size={14} />
          <span className="hidden sm:inline">{showArchived ? 'الأرشيف' : 'الأرشيف'}</span>
        </button>
      </div>

      {/* Create List Form */}
      {isCreatingList && (
        <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-4 space-y-3 animate-fadeIn">
          <h3 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
            <ShoppingBag size={14} />
            قائمة تسوق جديدة
          </h3>
          <input
            type="text"
            value={newListName}
            onChange={e => setNewListName(e.target.value)}
            placeholder="اسم القائمة (مثال: أسبوعية، عيد، رمضان...)"
            className="w-full bg-slate-950 text-slate-100 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-emerald-500/50"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && createList()}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">الميزانية (اختياري)</label>
              <input
                type="number"
                value={newListBudget}
                onChange={e => setNewListBudget(e.target.value)}
                placeholder="مثال: 500 ريال"
                className="w-full bg-slate-950 text-slate-100 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">اسم المتجر (اختياري)</label>
              <input
                type="text"
                value={newListStore}
                onChange={e => setNewListStore(e.target.value)}
                placeholder="مثال: كارفور، بنده..."
                className="w-full bg-slate-950 text-slate-100 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {LIST_COLORS.map(c => (
              <button key={c.id} onClick={() => setNewListColor(c.id)}
                className={`w-7 h-7 rounded-full ${c.bg} flex items-center justify-center transition-all ${
                  newListColor === c.id ? `ring-2 ring-offset-2 ring-offset-slate-900 ${c.ring} scale-110` : 'opacity-60 hover:opacity-90'
                }`}
              >
                {newListColor === c.id && <Check size={12} className="text-white stroke-[3]" />}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={createList} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2 rounded-xl text-xs font-bold">
              إنشاء القائمة
            </button>
            <button onClick={() => setIsCreatingList(false)} className="flex-1 bg-slate-800 text-slate-300 py-2 rounded-xl text-xs">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Lists Grid */}
      {filteredLists.length === 0 ? (
        <div className="text-center py-14 bg-slate-900/20 rounded-2xl border border-slate-800/30">
          <ShoppingCart size={30} className="mx-auto mb-2 text-slate-600 opacity-40" />
          <p className="text-xs text-slate-500">{showArchived ? 'لا توجد قوائم مؤرشفة' : 'لا توجد قوائم تسوق بعد'}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredLists.map(list => {
            const { total, done, cost, totalCost } = listStats(list);
            const colorMeta = getListColor(list.color);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <button
                key={list.id}
                onClick={() => { setActiveListId(list.id); setView('detail'); setFilterCat('all'); }}
                className={`text-right border rounded-2xl p-4 transition-all hover:scale-[1.01] active:scale-[0.99] w-full ${colorMeta.chip}`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${colorMeta.bg} shrink-0 mt-1`} />
                    <h3 className="text-sm font-bold text-white">{list.name}</h3>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {onShareList && (
                      <button onClick={() => onShareList(list)} className="p-1 text-slate-400 hover:text-sky-400 rounded" title="مشاركة">
                        <Share2 size={13} />
                      </button>
                    )}
                    {onDuplicateList && (
                      <button onClick={() => onDuplicateList(list.id)} className="p-1 text-slate-400 hover:text-purple-400 rounded" title="إنشاء نسخة">
                        <CopyPlus size={13} />
                      </button>
                    )}
                    <button onClick={() => toggleArchiveList(list.id)} className="p-1 text-slate-400 hover:text-amber-400 rounded" title={list.isArchived ? 'استعادة' : 'أرشفة'}>
                      {list.isArchived ? <RefreshCw size={13} /> : <Archive size={13} />}
                    </button>
                    <button onClick={() => deleteList(list.id)} className="p-1 text-slate-400 hover:text-rose-400 rounded" title="حذف">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap gap-1.5 text-[10px] mb-3">
                  {list.store && (
                    <span className="flex items-center gap-0.5 bg-slate-900/40 px-1.5 py-0.5 rounded">
                      <Store size={9} />{list.store}
                    </span>
                  )}
                  {list.budget && (
                    <span className="flex items-center gap-0.5 bg-slate-900/40 px-1.5 py-0.5 rounded">
                      <DollarSign size={9} />ميزانية {list.budget.toLocaleString('ar-EG')}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                {total > 0 && (
                  <>
                    <div className="h-1.5 bg-slate-900/40 rounded-full overflow-hidden mb-1.5">
                      <div className={`h-full ${colorMeta.bg} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">{done} من {total} منتج · {pct}%</span>
                      {totalCost > 0 && (
                        <span className="text-slate-400">
                          {cost.toFixed(1)} / {totalCost.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </>
                )}

                {total === 0 && <p className="text-[11px] text-slate-500 italic">القائمة فارغة</p>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ─── Detail View ─── */
  const renderDetail = () => {
    if (!activeList) return null;
    const { total, done, cost, totalCost } = listStats(activeList);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const colorMeta = getListColor(activeList.color);
    const overBudget = activeList.budget && cost > activeList.budget;
    const categoriesInList = Array.from(new Set(activeList.items.map(i => i.category)));

    return (
      <div className="flex flex-col h-full animate-fadeIn">
        {/* Header */}
        <div className={`${colorMeta.chip} border-b px-4 py-3 shrink-0`}>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => { setView('home'); setAddItemMode(false); setEditingListMeta(false); }}
              className="flex items-center gap-1 bg-slate-900/50 text-slate-300 hover:text-white py-1 pr-1 pl-2.5 rounded-lg text-xs"
            >
              ← رجوع
            </button>

            <div className="flex items-center gap-1">
              {onShareList && (
                <button onClick={() => onShareList(activeList)} className="p-1.5 bg-slate-900/40 rounded-lg text-slate-300 hover:text-sky-400" title="مشاركة">
                  <Share2 size={15} />
                </button>
              )}
              {onDuplicateList && (
                <button onClick={() => onDuplicateList(activeList.id)} className="p-1.5 bg-slate-900/40 rounded-lg text-slate-300 hover:text-purple-400" title="إنشاء نسخة">
                  <CopyPlus size={15} />
                </button>
              )}
              <button onClick={() => {
                setEditListName(activeList.name);
                setEditListBudget(activeList.budget?.toString() ?? '');
                setEditListStore(activeList.store ?? '');
                setEditListColor(activeList.color);
                setEditingListMeta(p => !p);
              }} className="p-1.5 bg-slate-900/40 rounded-lg text-slate-300 hover:text-amber-400" title="تعديل">
                <Edit3 size={15} />
              </button>
              <button onClick={checkAll} className="p-1.5 bg-slate-900/40 rounded-lg text-slate-300 hover:text-emerald-400" title="تحديد الكل">
                <CheckCircle2 size={15} />
              </button>
              <button onClick={() => setAddItemMode(p => !p)} className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                addItemMode ? 'bg-slate-700 text-slate-300' : 'bg-emerald-500 text-slate-950'
              }`}>
                {addItemMode ? <X size={14} /> : <Plus size={14} />}
                <span>{addItemMode ? 'إلغاء' : 'إضافة'}</span>
              </button>
            </div>
          </div>

          <h2 className="text-base font-extrabold text-white mt-2">{activeList.name}</h2>

          {/* Progress summary */}
          <div className="mt-2 space-y-1">
            <div className="h-2 bg-slate-900/40 rounded-full overflow-hidden">
              <div className={`h-full ${colorMeta.bg} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-300">{done}/{total} منتج · {pct}%</span>
              {totalCost > 0 && (
                <span className={overBudget ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                  {cost.toFixed(1)} / {activeList.budget ? `${activeList.budget} (ميزانية)` : totalCost.toFixed(1)}
                  {overBudget && ' ⚠️'}
                </span>
              )}
            </div>
          </div>

          {/* Store / Budget chips */}
          {(activeList.store || activeList.budget) && (
            <div className="flex gap-1.5 mt-1.5 text-[9px]">
              {activeList.store && <span className="flex items-center gap-0.5 bg-slate-900/40 px-2 py-0.5 rounded-full"><Store size={9} />{activeList.store}</span>}
              {activeList.budget && <span className="flex items-center gap-0.5 bg-slate-900/40 px-2 py-0.5 rounded-full"><DollarSign size={9} />الميزانية: {activeList.budget.toLocaleString('ar-EG')}</span>}
            </div>
          )}
        </div>

        {/* Edit List Meta */}
        {editingListMeta && (
          <div className="bg-slate-900 border-b border-slate-800 p-3 space-y-2 shrink-0 animate-fadeIn">
            <input type="text" value={editListName} onChange={e => setEditListName(e.target.value)} placeholder="اسم القائمة" className="w-full bg-slate-950 text-slate-100 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-amber-500/50" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={editListBudget} onChange={e => setEditListBudget(e.target.value)} placeholder="الميزانية" className="bg-slate-950 text-slate-100 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none w-full" />
              <input type="text" value={editListStore} onChange={e => setEditListStore(e.target.value)} placeholder="المتجر" className="bg-slate-950 text-slate-100 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none w-full" />
            </div>
            <div className="flex items-center gap-1.5">
              {LIST_COLORS.map(c => <button key={c.id} onClick={() => setEditListColor(c.id)} className={`w-6 h-6 rounded-full ${c.bg} flex items-center justify-center transition-all ${editListColor === c.id ? `ring-2 ring-offset-1 ring-offset-slate-900 ${c.ring} scale-110` : 'opacity-50'}`}>{editListColor === c.id && <Check size={10} className="text-white stroke-[3]" />}</button>)}
            </div>
            <div className="flex gap-2">
              <button onClick={saveListMeta} className="flex-1 bg-amber-500 text-slate-950 py-1.5 rounded-xl text-xs font-bold">حفظ</button>
              <button onClick={() => setEditingListMeta(false)} className="flex-1 bg-slate-800 text-slate-300 py-1.5 rounded-xl text-xs">إلغاء</button>
            </div>
          </div>
        )}

        {/* Add Item Panel */}
        {addItemMode && (
          <div className="bg-slate-900 border-b border-slate-800 p-3 space-y-2.5 shrink-0 animate-fadeIn">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder="اسم المنتج..."
                className="flex-1 bg-slate-950 text-slate-100 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600"
                autoFocus
              />
              <button onClick={addItem} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 rounded-xl font-bold text-lg transition-all active:scale-90">
                <Plus size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="text-[9px] text-slate-500 block mb-0.5">الكمية</label>
                <input type="number" min="0.1" step="0.1" value={newItemQty} onChange={e => setNewItemQty(e.target.value)}
                  className="w-full bg-slate-950 text-slate-100 text-[11px] rounded-lg px-2 py-1.5 border border-slate-800 focus:outline-none" />
              </div>
              <div>
                <label className="text-[9px] text-slate-500 block mb-0.5">الوحدة</label>
                <select value={newItemUnit} onChange={e => setNewItemUnit(e.target.value as ShopItemUnit)}
                  className="w-full bg-slate-950 text-slate-300 text-[11px] rounded-lg px-1.5 py-1.5 border border-slate-800 focus:outline-none">
                  {SHOP_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-slate-500 block mb-0.5">السعر (اختياري)</label>
                <input type="number" min="0" step="0.1" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-950 text-slate-100 text-[11px] rounded-lg px-2 py-1.5 border border-slate-800 focus:outline-none" />
              </div>
            </div>

            {/* Category pills */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0.5">
              {SHOP_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setNewItemCat(cat.id)}
                  className={`text-[10px] px-2 py-1 rounded-lg border whitespace-nowrap flex items-center gap-0.5 transition-all ${
                    newItemCat === cat.id ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  <span>{cat.emoji}</span><span>{cat.label}</span>
                </button>
              ))}
            </div>

            <input
              type="text"
              value={newItemNote}
              onChange={e => setNewItemNote(e.target.value)}
              placeholder="ملاحظة (اختياري): ماركة، لون، مقاس..."
              className="w-full bg-slate-950 text-slate-100 text-[11px] rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600"
            />
          </div>
        )}

        {/* Category Filter */}
        {categoriesInList.length > 1 && (
          <div className="px-3 py-2 border-b border-slate-800 bg-slate-950/40 shrink-0">
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              <button onClick={() => setFilterCat('all')} className={`text-[10px] px-2 py-1 rounded-lg border whitespace-nowrap transition-all ${filterCat === 'all' ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                الكل ({activeList.items.length})
              </button>
              {categoriesInList.map(cat => {
                const meta = getCatMeta(cat);
                const count = activeList.items.filter(i => i.category === cat).length;
                return (
                  <button key={cat} onClick={() => setFilterCat(cat)} className={`text-[10px] px-2 py-1 rounded-lg border whitespace-nowrap flex items-center gap-0.5 transition-all ${filterCat === cat ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                    {meta.emoji}<span>{meta.label}</span><span className="text-[9px]">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Items Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 pb-20">
          {activeList.items.length === 0 ? (
            <div className="text-center py-14 text-slate-600">
              <Package size={30} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs">القائمة فارغة. أضف منتجات بالزر أعلاه.</p>
            </div>
          ) : (
            Object.entries(groupedItems).map(([catKey, items]) => {
              const catMeta = getCatMeta(catKey as ShopCategory);
              const doneInCat = items.filter(i => i.checked).length;
              return (
                <div key={catKey} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold px-1">
                    <span>{catMeta.emoji}</span>
                    <span>{catMeta.label}</span>
                    <span className="text-[10px] font-normal text-slate-600">({doneInCat}/{items.length})</span>
                    <div className="flex-1 h-px bg-slate-800 mr-1" />
                  </div>

                  {items.map(item => {
                    const unitLabel = SHOP_UNITS.find(u => u.id === item.unit)?.label ?? item.unit;
                    const isEditing = editingItemId === item.id;

                    return (
                      <div key={item.id} className={`bg-slate-900/50 border rounded-2xl px-3 py-2.5 transition-all ${
                        item.checked ? 'border-slate-800/40 opacity-60' : 'border-slate-800'
                      }`}>
                        {isEditing ? (
                          <div className="space-y-2">
                            <input type="text" value={editItemName} onChange={e => setEditItemName(e.target.value)} className="w-full bg-slate-950 text-slate-100 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-amber-500/50" />
                            <div className="grid grid-cols-3 gap-1.5">
                              <input type="number" value={editItemQty} onChange={e => setEditItemQty(e.target.value)} className="bg-slate-950 text-slate-100 text-[11px] rounded-lg px-2 py-1.5 border border-slate-800 focus:outline-none" />
                              <select value={editItemUnit} onChange={e => setEditItemUnit(e.target.value as ShopItemUnit)} className="bg-slate-950 text-slate-300 text-[11px] rounded-lg px-1.5 py-1.5 border border-slate-800 focus:outline-none">
                                {SHOP_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                              </select>
                              <input type="number" value={editItemPrice} onChange={e => setEditItemPrice(e.target.value)} placeholder="سعر" className="bg-slate-950 text-slate-100 text-[11px] rounded-lg px-2 py-1.5 border border-slate-800 focus:outline-none" />
                            </div>
                            <input type="text" value={editItemNote} onChange={e => setEditItemNote(e.target.value)} placeholder="ملاحظة" className="w-full bg-slate-950 text-slate-100 text-[11px] rounded-xl px-3 py-2 border border-slate-800 focus:outline-none" />
                            <div className="flex gap-1.5">
                              <button onClick={() => saveEditItem(item.id)} className="flex-1 bg-amber-500 text-slate-950 py-1.5 rounded-xl text-xs font-bold">حفظ</button>
                              <button onClick={() => setEditingItemId(null)} className="flex-1 bg-slate-800 text-slate-300 py-1.5 rounded-xl text-xs">إلغاء</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2.5">
                              <button onClick={() => toggleItemCheck(item.id)} className={`shrink-0 transition-transform active:scale-90 ${item.checked ? 'text-emerald-400' : 'text-slate-600 hover:text-emerald-500'}`}>
                                {item.checked ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                              </button>

                              <div className="flex-1 min-w-0" onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-bold ${item.checked ? 'line-through text-slate-500' : 'text-white'}`}>{item.name}</span>
                                  <span className="text-[10px] text-slate-500">{item.qty} {unitLabel}</span>
                                  {item.price && <span className="text-[10px] text-amber-400">{(item.price * item.qty).toFixed(1)}</span>}
                                </div>
                                {item.note && !expandedItemId?.includes(item.id) && (
                                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{item.note}</p>
                                )}
                              </div>

                              <div className="flex items-center gap-0.5 shrink-0">
                                <button onClick={() => { setEditingItemId(item.id); setEditItemName(item.name); setEditItemQty(item.qty.toString()); setEditItemUnit(item.unit); setEditItemPrice(item.price?.toString() ?? ''); setEditItemNote(item.note ?? ''); }} className="p-1 text-slate-600 hover:text-amber-400 rounded">
                                  <Edit3 size={12} />
                                </button>
                                <button onClick={() => deleteItem(item.id)} className="p-1 text-slate-600 hover:text-rose-400 rounded">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {expandedItemId === item.id && item.note && (
                              <p className="text-[11px] text-slate-400 mt-1.5 pr-7 leading-relaxed">{item.note}</p>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Bottom action bar */}
        {activeList.items.some(i => i.checked) && (
          <div className="border-t border-slate-800 bg-slate-900 p-3 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-400">{done} منتج تم شراؤه</span>
            <button onClick={clearChecked} className="text-xs bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors">
              <Trash2 size={13} />
              <span>حذف المشتراة</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return view === 'home' ? renderHome() : renderDetail();
};
