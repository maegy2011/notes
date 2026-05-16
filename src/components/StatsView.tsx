import React, { useState, useEffect } from 'react';
import { Note, ThemeMode } from '../types';
import {
  BarChart2, RefreshCcw, Cloud, Trash2, Heart, Award, Lock, LockKeyhole,
  ShieldCheck, Sun, Moon, Monitor, Sparkles, Layout, Type, ArrowUpDown,
  Compass, Palette, Download, Upload, Database, Link2, KeyRound, RefreshCw
} from 'lucide-react';
import { tursoHelpers, TursoConfig } from '../utils/tursoSync';

export interface AppSettings {
  syncOnLaunch: boolean;
  defaultScreen: string;
  defaultColor: string;
  defaultFontType: string;
  defaultFontSize: string;
  listItemHeight: string;
  defaultSortOrder: string;
}

interface StatsViewProps {
  notes: Note[];
  onResetData: () => void;
  onClearAll: () => void;
  onOpenPinSetup: () => void;
  onClearPin: () => void;
  onToggleAppLock: (enabled: boolean) => void;
  hasPin: boolean;
  appLockEnabled: boolean;
  themeMode: ThemeMode;
  onChangeThemeMode: (mode: ThemeMode) => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showToast: (msg: string) => void;
}

export const StatsView: React.FC<StatsViewProps> = ({
  notes,
  onResetData,
  onClearAll,
  onOpenPinSetup,
  onClearPin,
  onToggleAppLock,
  hasPin,
  appLockEnabled,
  themeMode,
  onChangeThemeMode,
  settings,
  onUpdateSettings,
  onExportData,
  onImportData,
  showToast
}) => {
  const [cloudSync, setCloudSync] = useState(settings.syncOnLaunch);

  // Turso Sync States
  const [tursoUrl, setTursoUrl] = useState(() => tursoHelpers.getConfig().url);
  const [tursoToken, setTursoToken] = useState(() => tursoHelpers.getConfig().token);
  const [tursoAutoSync, setTursoAutoSync] = useState(() => tursoHelpers.getConfig().autoSync);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Save Turso config on change
  useEffect(() => {
    tursoHelpers.saveConfig({
      url: tursoUrl,
      token: tursoToken,
      autoSync: tursoAutoSync
    });
  }, [tursoUrl, tursoToken, tursoAutoSync]);

  const handleTestTurso = async () => {
    if (!tursoUrl.trim() || !tursoToken.trim()) {
      showToast('⚠️ يرجى إدخال رابط قاعدة البيانات ورمز المرور أولاً');
      return;
    }
    setIsTesting(true);
    try {
      const sanitized = tursoHelpers.sanitizeUrl(tursoUrl);
      const config: TursoConfig = { url: sanitized, token: tursoToken, autoSync: tursoAutoSync };
      const success = await tursoHelpers.testConnection(config);
      if (success) {
        showToast('✅ تم الاتصال بقاعدة بيانات Turso بنجاح!');
      } else {
        showToast('❌ فشل الاتصال بقاعدة البيانات');
      }
    } catch (err) {
      showToast('❌ خطأ في الاتصال: تحقق من الرابط أو رمز المرور');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncTurso = async () => {
    if (!tursoUrl.trim() || !tursoToken.trim()) {
      showToast('⚠️ يرجى إدخال وإعداد بيانات الاتصال بـ Turso أولاً');
      return;
    }
    setIsSyncing(true);
    try {
      const sanitized = tursoHelpers.sanitizeUrl(tursoUrl);
      const config: TursoConfig = { url: sanitized, token: tursoToken, autoSync: tursoAutoSync };
      await tursoHelpers.syncNow(config, showToast);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[Turso Sync Error]', err);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const totalNotes = notes.filter(n => !n.isTrash).length;
  const lockedNotesCount = notes.filter(n => n.isLocked).length;
  const pinnedCount = notes.filter(n => n.isPinned && !n.isTrash && !n.isArchived).length;
  const favoriteCount = notes.filter(n => n.isFavorite && !n.isTrash && !n.isArchived).length;
  const archivedCount = notes.filter(n => n.isArchived && !n.isTrash).length;
  const totalCharacters = notes.reduce((acc, curr) => acc + (curr.content?.length || 0) + (curr.title?.length || 0), 0);
  const totalChecklistItems = notes.reduce((acc, curr) => acc + (curr.checklist?.length || 0), 0);
  const completedChecklistItems = notes.reduce((acc, curr) => acc + (curr.checklist?.filter(c => c.completed).length || 0), 0);

  const handleToggleSync = () => {
    const val = !cloudSync;
    setCloudSync(val);
    onUpdateSettings({ syncOnLaunch: val });
    showToast(val ? 'تم تفعيل المزامنة عند التشغيل' : 'تم إيقاف المزامنة عند التشغيل');
  };

  return (
    <div className="p-4 space-y-4 pb-24 animate-fadeIn select-none">
      {/* Title block */}
      <div className="flex items-center gap-2 mb-2">
        <BarChart2 size={18} className="text-amber-500" />
        <h2 className="text-sm font-bold text-white">لوحة الإعدادات والأداء</h2>
      </div>

      {/* Theme Selection Section */}
      <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60 space-y-2.5">
        <div className="flex items-center gap-2">
          <Sun size={16} className="text-amber-400" />
          <h3 className="text-xs font-bold text-slate-200">مظهر التطبيق</h3>
        </div>

        <div className="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-750">
          {[
            { id: 'light', label: 'فاتح', Icon: Sun },
            { id: 'dark', label: 'داكن', Icon: Moon },
            { id: 'system', label: 'تلقائي', Icon: Monitor },
          ].map(item => {
            const IconComponent = item.Icon;
            const active = themeMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeThemeMode(item.id as ThemeMode)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  active ? 'bg-amber-500 text-slate-950 shadow-md font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <IconComponent size={14} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Customization Settings Window */}
      <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60 space-y-3.5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-amber-400" />
          <h3 className="text-xs font-bold text-slate-200">تخصيص المظهر والافتراضيات</h3>
        </div>

        <div className="space-y-3">
          {/* Default Screen */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Compass size={14} className="text-slate-400" />
              <span>الشاشة الافتراضية عند الفتح:</span>
            </div>
            <select
              value={settings.defaultScreen}
              onChange={(e) => {
                onUpdateSettings({ defaultScreen: e.target.value });
                showToast(`تم اختيار الشاشة الافتراضية: ${e.target.value === 'notes' ? 'الملاحظات' : e.target.value === 'tasks' ? 'المهام' : e.target.value === 'shopping' ? 'التسوق' : e.target.value === 'calendar' ? 'التقويم' : 'الإعدادات'}`);
              }}
              className="bg-slate-900 text-slate-200 text-[11px] rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:border-amber-500/50"
            >
              <option value="notes">🗒️ الملاحظات</option>
              <option value="tasks">☑️ المهام</option>
              <option value="shopping">🛒 التسوق</option>
              <option value="calendar">📅 التقويم</option>
              <option value="settings">⚙️ الإعدادات</option>
            </select>
          </div>

          {/* Default Note Color */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Palette size={14} className="text-slate-400" />
              <span>لون الملاحظة الافتراضي الجديد:</span>
            </div>
            <select
              value={settings.defaultColor}
              onChange={(e) => {
                onUpdateSettings({ defaultColor: e.target.value });
                showToast('تم تعيين لون الملاحظة الجديد الافتراضي');
              }}
              className="bg-slate-900 text-slate-200 text-[11px] rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:border-amber-500/50"
            >
              <option value="amber">🔶 كهرماني</option>
              <option value="emerald">🟢 أخضر زمردي</option>
              <option value="sky">🔵 أزرق سماوي</option>
              <option value="rose">🔴 وردي</option>
              <option value="purple">🟣 بنفسجي</option>
              <option value="slate">🔘 رمادي</option>
            </select>
          </div>

          {/* Default Font Type */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Type size={14} className="text-slate-400" />
              <span>نوع خط الكتابة الافتراضي:</span>
            </div>
            <select
              value={settings.defaultFontType}
              onChange={(e) => {
                onUpdateSettings({ defaultFontType: e.target.value });
                showToast('تم تحديث نوع الخط الافتراضي');
              }}
              className="bg-slate-900 text-slate-200 text-[11px] rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:border-amber-500/50"
            >
              <option value="cairo">خط القاهرة (Cairo)</option>
              <option value="monospace">أحادي المسافة (Monospace)</option>
              <option value="sans-serif">خط بسيط (Sans-Serif)</option>
              <option value="serif">خط كلاسيكي (Serif)</option>
            </select>
          </div>

          {/* Default Font Size */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Layout size={14} className="text-slate-400" />
              <span>حجم خط الكتابة الافتراضي:</span>
            </div>
            <select
              value={settings.defaultFontSize}
              onChange={(e) => {
                onUpdateSettings({ defaultFontSize: e.target.value });
                showToast('تم تحديث حجم الخط الافتراضي');
              }}
              className="bg-slate-900 text-slate-200 text-[11px] rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:border-amber-500/50"
            >
              <option value="sm">صغير جداً</option>
              <option value="base">عادي/متوسط</option>
              <option value="lg">كبير</option>
              <option value="xl">كبير جداً</option>
            </select>
          </div>

          {/* List Item Height */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Type size={14} className="text-slate-400" />
              <span>ارتفاع عناصر القائمة:</span>
            </div>
            <select
              value={settings.listItemHeight}
              onChange={(e) => {
                onUpdateSettings({ listItemHeight: e.target.value });
                showToast(`تم تعديل ارتفاع القائمة إلى: ${e.target.value === 'normal' ? 'طبيعي' : e.target.value === 'small' ? 'صغير' : 'صغير جداً'}`);
              }}
              className="bg-slate-900 text-slate-200 text-[11px] rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:border-amber-500/50"
            >
              <option value="normal">طبيعي (Normal)</option>
              <option value="small">صغير (Small)</option>
              <option value="tiny">ضئيل/صغير جداً (Tiny)</option>
            </select>
          </div>

          {/* Default Sort Order */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <ArrowUpDown size={14} className="text-slate-400" />
              <span>ترتيب الفرز الافتراضي للملاحظات:</span>
            </div>
            <select
              value={settings.defaultSortOrder}
              onChange={(e) => {
                onUpdateSettings({ defaultSortOrder: e.target.value });
                showToast('تم تحديث ترتيب الفرز الافتراضي');
              }}
              className="bg-slate-900 text-slate-200 text-[11px] rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:border-amber-500/50"
            >
              <option value="updatedAt">⏱️ تاريخ التعديل</option>
              <option value="createdAt">📅 تاريخ الإنشاء</option>
              <option value="color">🎨 حسب اللون</option>
              <option value="title">🔤 أبجدياً (العنوان)</option>
              <option value="reminder">🔔 وقت التذكير</option>
              <option value="last-used">🔄 آخر ترتيب مستخدم</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lock Security Section */}
      <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={16} className="text-sky-400" />
          <h3 className="text-xs font-bold text-slate-200">🔐 الأمان والحماية</h3>
        </div>

        <div className="space-y-3">
          {/* App Lock Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${appLockEnabled ? 'bg-sky-500/10 text-sky-400' : 'bg-slate-800 text-slate-500'}`}>
                <Lock size={15} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">قفل التطبيق بالرقم السري</h4>
                <p className="text-[10px] text-slate-400">
                  {hasPin 
                    ? appLockEnabled ? 'التطبيق محمي عند فتحه' : 'الرقم السري موجود لكن التطبيق غير مقفل'
                    : 'لم يتم تعيين رقم سري بعد'}
                </p>
              </div>
            </div>

            {hasPin ? (
              <button
                onClick={() => onToggleAppLock(!appLockEnabled)}
                className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${appLockEnabled ? 'bg-sky-500' : 'bg-slate-700'}`}
              >
                <div className={`w-5 h-5 bg-slate-950 rounded-full transition-transform ${appLockEnabled ? 'translate-x-0' : '-translate-x-4'}`} />
              </button>
            ) : (
              <button
                onClick={onOpenPinSetup}
                className="text-[11px] bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                تعيين رمز
              </button>
            )}
          </div>

          {/* Locked notes count + Change/Remove PIN */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-700/30">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <LockKeyhole size={13} className="text-amber-400" />
              <span>الملاحظات المقفلة: <span className="font-bold text-amber-400">{lockedNotesCount}</span></span>
            </div>

            <div className="flex items-center gap-1.5">
              {hasPin && (
                <>
                  <button
                    onClick={onOpenPinSetup}
                    className="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded-lg transition-colors"
                  >
                    تغيير الرمز
                  </button>
                  <button
                    onClick={onClearPin}
                    className="text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-2 py-1 rounded-lg transition-colors"
                  >
                    إزالة
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid counters */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
          <span className="text-[11px] text-slate-400 block mb-0.5">إجمالي الملاحظات</span>
          <span className="text-lg font-extrabold text-white">{totalNotes}</span>
          <span className="text-[9px] text-slate-500 block mt-1">نشطة ومؤرشفة</span>
        </div>

        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
          <span className="text-[11px] text-slate-400 block mb-0.5">إجمالي الحروف</span>
          <span className="text-lg font-extrabold text-amber-400">{totalCharacters}</span>
          <span className="text-[9px] text-slate-500 block mt-1">نص مدخل في التطبيق</span>
        </div>

        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
          <span className="text-[11px] text-slate-400 block mb-0.5">المهام المنجزة</span>
          <span className="text-lg font-extrabold text-emerald-400">
            {completedChecklistItems} <span className="text-xs font-normal text-slate-500">/ {totalChecklistItems}</span>
          </span>
          <span className="text-[9px] text-slate-500 block mt-1">عناصر قوائم المهام</span>
        </div>

        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
          <span className="text-[11px] text-slate-400 block mb-0.5">مقفل + مفضل + مثبت</span>
          <span className="text-lg font-extrabold text-rose-400">{lockedNotesCount + favoriteCount + pinnedCount + archivedCount}</span>
          <span className="text-[9px] text-slate-500 block mt-1">سجلات وعناصر هامة</span>
        </div>
      </div>

      {/* Cloud Synchronisation status */}
      <div className="bg-slate-850 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between mt-2">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${cloudSync ? 'bg-sky-500/10 text-sky-400' : 'bg-slate-800 text-slate-500'}`}>
            <Cloud size={16} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200">المزامنة السحابية المشفرة</h4>
            <p className="text-[10px] text-slate-400">{cloudSync ? 'متصل ومحمي تلقائياً' : 'المزامنة متوقفة حالياً'}</p>
          </div>
        </div>

        <button
          onClick={handleToggleSync}
          className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${cloudSync ? 'bg-amber-500' : 'bg-slate-700'}`}
        >
          <div className={`w-5 h-5 bg-slate-950 rounded-full transition-transform ${cloudSync ? 'translate-x-0' : '-translate-x-4'}`} />
        </button>
      </div>

      {/* Turso DB Sync (Optional) Section */}
      <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-sky-400" />
            <h3 className="text-xs font-bold text-slate-200">🔄 مزامنة Turso (اختياري)</h3>
          </div>
          <span className="text-[9px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full border border-sky-500/20 font-bold">
            قاعدة بيانات Edge
          </span>
        </div>

        <div className="space-y-3">
          {/* DB URL Input */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 flex items-center gap-1 pr-1">
              <Link2 size={12} className="text-slate-500" />
              <span>رابط قاعدة بيانات Turso:</span>
            </label>
            <input
              type="text"
              value={tursoUrl}
              onChange={e => setTursoUrl(e.target.value)}
              placeholder="https://my-db-org.turso.io"
              className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-sky-500/50 placeholder:text-slate-600 dir-ltr text-left font-sans"
            />
          </div>

          {/* Auth Token Input */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 flex items-center gap-1 pr-1">
              <KeyRound size={12} className="text-slate-500" />
              <span>رمز المرور (Auth Token):</span>
            </label>
            <input
              type="password"
              value={tursoToken}
              onChange={e => setTursoToken(e.target.value)}
              placeholder="••••••••••••••••••••••••••••••••"
              className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-sky-500/50 placeholder:text-slate-600 dir-ltr text-left font-sans"
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleTestTurso}
              disabled={isTesting}
              className="py-2.5 rounded-xl text-xs font-bold border border-slate-700 text-slate-300 bg-slate-900 hover:bg-slate-850 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 active:scale-95"
            >
              {isTesting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>جاري الاتصال...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={13} />
                  <span>اختبار الاتصال</span>
                </>
              )}
            </button>

            <button
              onClick={handleSyncTurso}
              disabled={isSyncing}
              className="py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 active:scale-95"
            >
              {isSyncing ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>جاري المزامنة...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={13} />
                  <span>مزامنة الآن</span>
                </>
              )}
            </button>
          </div>

          {/* Auto Sync Toggle */}
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/40">
            <div>
              <h4 className="text-xs font-bold text-slate-200">المزامنة التلقائية</h4>
              <p className="text-[10px] text-slate-400">مزامنة التعديلات تلقائياً مع كل حفظ</p>
            </div>
            <button
              onClick={() => setTursoAutoSync(!tursoAutoSync)}
              className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${tursoAutoSync ? 'bg-sky-400' : 'bg-slate-700'}`}
            >
              <div className={`w-5 h-5 bg-slate-950 rounded-full transition-transform ${tursoAutoSync ? 'translate-x-0' : '-translate-x-4'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Backup & Restore Controls */}
      <div className="space-y-2 pt-2">
        <span className="text-[11px] text-slate-500 font-medium px-1 block">النسخ الاحتياطي واستعادة البيانات</span>
        
        <div className="grid grid-cols-2 gap-2">
          {/* Export Data Button */}
          <button
            onClick={onExportData}
            className="bg-slate-850 hover:bg-slate-800 text-slate-300 p-3 rounded-xl text-xs border border-slate-750 transition-colors flex flex-col items-center justify-center gap-1.5 text-center active:scale-95"
            title="تصدير جميع البيانات في ملف JSON خارجي"
          >
            <Download size={18} className="text-amber-400" />
            <span className="font-bold text-slate-200">تصدير البيانات (تنزيل)</span>
            <span className="text-[9px] text-slate-500">حفظ ملاحظاتك وتفضيلاتك بملف خارجي</span>
          </button>

          {/* Import Data Button */}
          <label
            className="bg-slate-850 hover:bg-slate-800 text-slate-300 p-3 rounded-xl text-xs border border-slate-750 transition-colors flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer active:scale-95"
            title="استيراد ورفع ملف النسخة الاحتياطية لاستعادتها"
          >
            <Upload size={18} className="text-sky-400" />
            <span className="font-bold text-slate-200">استيراد البيانات (تحميل)</span>
            <span className="text-[9px] text-slate-500">رفع ملف النسخة الاحتياطية واستعادتها</span>
            <input
              type="file"
              accept=".json"
              onChange={onImportData}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Storage controls */}
      <div className="space-y-2 pt-2">
        <span className="text-[11px] text-slate-500 font-medium px-1 block">إدارة قاعدة البيانات المحلية</span>
        
        <button
          onClick={onResetData}
          className="w-full bg-slate-850 hover:bg-slate-800 text-slate-300 p-3 rounded-xl text-xs flex items-center justify-between border border-slate-750 transition-colors"
        >
          <div className="flex items-center gap-2">
            <RefreshCcw size={14} className="text-amber-400" />
            <div className="text-right">
              <span className="block font-bold text-slate-200">استعادة الملاحظات الافتراضية</span>
              <span className="block text-[10px] text-slate-500">تحميل النماذج التوضيحية والأفكار الجاهزة</span>
            </div>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded">إعادة تعيين</span>
        </button>

        <button
          onClick={onClearAll}
          className="w-full bg-rose-500/10 hover:bg-rose-500/15 text-rose-300 p-3 rounded-xl text-xs flex items-center justify-between border border-rose-500/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Trash2 size={14} className="text-rose-400" />
            <div className="text-right">
              <span className="block font-bold">مسح جميع الملاحظات</span>
              <span className="block text-[10px] text-rose-400/70">حذف كافة البيانات المخزنة من المتصفح نهائياً</span>
            </div>
          </div>
          <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-1 rounded">حذف جذري</span>
        </button>
      </div>

      {/* App information widget */}
      <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-850 text-center space-y-1 mt-4">
        <div className="flex justify-center text-amber-500">
          <Award size={18} />
        </div>
        <h5 className="text-xs font-bold text-slate-300">ملاحظاتي للموبايل</h5>
        <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs mx-auto">
          تم تصميم هذا التطبيق لتقديم تجربة مشابهة تماماً للتطبيقات الأصلية (Native) مع تخزين محلي وتجاوب فائق مع الشاشات اللمسية.
        </p>
        <div className="pt-1 flex items-center justify-center gap-1 text-[10px] text-slate-400 font-medium">
          <span>صنع بكل</span>
          <Heart size={10} className="text-rose-500 fill-rose-500 inline" />
          <span>لإدارة أفكارك بكفاءة</span>
        </div>
      </div>
    </div>
  );
};
