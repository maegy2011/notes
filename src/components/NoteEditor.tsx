import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Note, NoteCategory, NoteColor, ChecklistItem, ReminderData, ReminderType } from '../types';
import { CATEGORY_LABELS, COLOR_CLASSES } from '../data/initialNotes';
import DOMPurify from 'dompurify';
import { uid } from '../utils/shareDuplicate';
import {
  ArrowRight,
  Check,
  Plus,
  Trash2,
  Mic,
  Palette,
  Tag,
  CheckSquare,
  Sparkles,
  Share2,
  Copy,
  Bell,
  CalendarClock,
  MapPin,
  X,
  Clock3,
} from 'lucide-react';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { FormattingToolbar, FormatAction } from './FormattingToolbar';

interface NoteEditorProps {
  note: Note | null;
  onSave: (noteData: Partial<Note>) => void;
  onClose: () => void;
  showToast: (msg: string) => void;
}

// Helper functions moved outside component
const toLocalDateTimeInput = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

const fromLocalDateTimeInput = (value?: string): string | undefined => {
  return value ? new Date(value).toISOString() : undefined;
};

const formatReminderPreview = (iso?: string): string => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ar-EG', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

// DOMPurify configuration - centralized for consistency
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'p', 'br',
                 'ul', 'ol', 'li', 'h1', 'h2', 'h3',
                 'blockquote', 'code', 'pre', 'span', 'a'],
  ALLOWED_ATTR: ['class', 'href', 'target', 'rel'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'style'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'style'],
};

// Get default settings from localStorage
const getDefaultSettings = () => {
  try {
    const saved = localStorage.getItem('notes_app_settings_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        defaultColor: parsed.defaultColor as NoteColor || 'amber',
      };
    }
  } catch {
    // Ignore errors
  }
  return { defaultColor: 'amber' as NoteColor };
};

export const NoteEditor: React.FC<NoteEditorProps> = ({ note, onSave, onClose, showToast }) => {
  const {
    value: title,
    setValue: setTitle,
    undo: undoTitle,
    redo: redoTitle,
    canUndo: canUndoTitle,
    canRedo: canRedoTitle,
    reset: resetTitle,
  } = useUndoRedo<string>('');

  const {
    value: content,
    setValue: setContent,
    undo: undoContent,
    redo: redoContent,
    canUndo: canUndoContent,
    canRedo: canRedoContent,
    reset: resetContent,
  } = useUndoRedo<string>('');

  const [category, setCategory] = useState<NoteCategory>('ideas');
  const [color, setColor] = useState<NoteColor>('amber');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'checklist'>('text');
  const [activeField, setActiveField] = useState<'title' | 'content'>('content');
  const [showReminderPanel, setShowReminderPanel] = useState(false);
  const [reminderType, setReminderType] = useState<ReminderType>('note');
  const [reminderAtInput, setReminderAtInput] = useState('');
  const [eventEndInput, setEventEndInput] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventNote, setEventNote] = useState('');
  const [editingTaskReminderId, setEditingTaskReminderId] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Memoize default settings
  const defaultSettings = useMemo(() => getDefaultSettings(), []);

  // Memoize static data
  const categories: NoteCategory[] = useMemo(() => ['work', 'personal', 'ideas', 'study'], []);
  const colors: NoteColor[] = useMemo(() => ['amber', 'emerald', 'sky', 'rose', 'purple', 'slate'], []);

  // Initialize note data
  useEffect(() => {
    if (note) {
      resetTitle(note.title);
      resetContent(note.content);
      setCategory(note.category);
      setColor(note.color);
      setChecklist(note.checklist || []);
      setShowReminderPanel(!!note.reminder);
      setReminderType(note.reminder?.type || 'note');
      setReminderAtInput(toLocalDateTimeInput(note.reminder?.datetime));
      setEventEndInput(toLocalDateTimeInput(note.reminder?.endDatetime));
      setEventLocation(note.reminder?.location || '');
      setEventNote(note.reminder?.note || '');
      if (note.checklist && note.checklist.length > 0) {
        setActiveTab('checklist');
      }
    } else {
      resetTitle('');
      resetContent('');
      setChecklist([]);
      setShowReminderPanel(false);
      setReminderType('note');
      setReminderAtInput('');
      setEventEndInput('');
      setEventLocation('');
      setEventNote('');
      setColor(defaultSettings.defaultColor);
    }
  }, [note, resetTitle, resetContent, defaultSettings.defaultColor]);

  // Update editor content with sanitized HTML
  useEffect(() => {
    if (editorRef.current) {
      const sanitized = DOMPurify.sanitize(content, DOMPURIFY_CONFIG);
      editorRef.current.innerHTML = sanitized;
    }
  }, [content]);

  // Memoized handlers
  const handleSimulateVoice = useCallback(() => {
    setIsRecording(true);
    showToast('جاري تسجيل الملاحظة الصوتية...');

    const voiceTemplates = [
      'تذكير: الاتصال بالعميل غداً صباحاً لمناقشة التعديلات النهائية للمشروع.',
      'فكرة تسويقية: عمل فيديو قصير يشرح مميزات التطبيق بأسلوب فكاهي ونشره على تيك توك.',
      'قائمة عاجلة: شراء أوراق طباعة، تجديد اشتراك الإنترنت، ومراجعة حسابات الشهر.',
      'خاطرة سريعة: الإبداع يولد من رحم التجربة والخطأ، لا تخف من إطلاق نسختك الأولى.'
    ];

    setTimeout(() => {
      const randomTemplate = voiceTemplates[Math.floor(Math.random() * voiceTemplates.length)];
      const voiceHtml = `<p class="text-amber-300">🎙️ <em>${randomTemplate}</em></p>`;
      setContent(prev => (prev ? `${prev}${voiceHtml}` : voiceHtml));
      if (!title) setTitle('🎙️ ملاحظة صوتية');
      setIsRecording(false);
      showToast('تم تحويل الصوت إلى نص منسق بنجاح!');
    }, 2000);
  }, [showToast, title, setContent, setTitle]);

  const handleAddChecklist = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newChecklistItem.trim()) return;

    setChecklist(prev => [
      ...prev,
      {
        id: uid(),
        text: newChecklistItem.trim(),
        completed: false,
      },
    ]);
    setNewChecklistItem('');
  }, [newChecklistItem]);

  const toggleChecklist = useCallback((id: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  }, []);

  const removeChecklist = useCallback((id: string) => {
    setChecklist(prev => prev.filter(item => item.id !== id));
    setEditingTaskReminderId(prev => prev === id ? null : prev);
  }, []);

  const setTaskReminder = useCallback((id: string, localValue: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, reminderAt: fromLocalDateTimeInput(localValue) } : item
    ));
  }, []);

  const clearTaskReminder = useCallback((id: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, reminderAt: undefined } : item
    ));
  }, []);

  const getReminderPayload = useCallback((): ReminderData | undefined => {
    if (!showReminderPanel || !reminderAtInput) return undefined;

    const payload: ReminderData = {
      type: reminderType,
      datetime: fromLocalDateTimeInput(reminderAtInput)!,
    };

    if (reminderType === 'event') {
      payload.endDatetime = fromLocalDateTimeInput(eventEndInput);
      payload.location = eventLocation.trim() || undefined;
      payload.note = eventNote.trim() || undefined;
    }

    return payload;
  }, [showReminderPanel, reminderAtInput, reminderType, eventEndInput, eventLocation, eventNote]);

  const handleSave = useCallback(() => {
    const cleanContent = content.replace(/<p><br><\/p>/g, '').trim();

    if (!title.trim() && !cleanContent && checklist.length === 0) {
      showToast('يرجى كتابة عنوان أو محتوى للملاحظة');
      return;
    }

    onSave({
      title: title.trim() || 'ملاحظة سريعة',
      content: cleanContent,
      category,
      color,
      checklist: checklist.length > 0 ? checklist : undefined,
      reminder: getReminderPayload(),
    });
  }, [content, title, checklist, category, color, getReminderPayload, onSave, showToast]);

  const handleCopy = useCallback(() => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = DOMPurify.sanitize(content, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    let plainText = tempDiv.textContent || tempDiv.innerText || '';

    const reminderPayload = getReminderPayload();
    let copyText = `${title}\n\n${plainText}`;
    
    if (reminderPayload) {
      copyText += `\n\n⏰ التذكير: ${formatReminderPreview(reminderPayload.datetime)}`;
      if (reminderPayload.type === 'event' && reminderPayload.endDatetime) {
        copyText += `\n🏁 نهاية الحدث: ${formatReminderPreview(reminderPayload.endDatetime)}`;
      }
      if (reminderPayload.location) {
        copyText += `\n📍 المكان: ${reminderPayload.location}`;
      }
    }
    
    if (checklist.length > 0) {
      copyText += '\n\nقائمة المهام:\n' + checklist.map(c => {
        const reminderText = c.reminderAt ? ` (⏰ ${formatReminderPreview(c.reminderAt)})` : '';
        return `${c.completed ? '✅' : '⬜'} ${c.text}${reminderText}`;
      }).join('\n');
    }
    
    navigator.clipboard.writeText(copyText);
    showToast('تم نسخ الملاحظة للحافظة');
  }, [content, title, getReminderPayload, checklist, showToast]);

  const applyFormat = useCallback((action: FormatAction) => {
    if (activeField !== 'content') return;

    switch (action) {
      case 'bold': document.execCommand('bold', false); break;
      case 'italic': document.execCommand('italic', false); break;
      case 'underline': document.execCommand('underline', false); break;
      case 'strike': document.execCommand('strikeThrough', false); break;
      case 'code': document.execCommand('fontName', false, 'monospace'); break;
      case 'h1': document.execCommand('formatBlock', false, '<h1>'); break;
      case 'h2': document.execCommand('formatBlock', false, '<h2>'); break;
      case 'list': document.execCommand('insertUnorderedList', false); break;
      case 'quote': document.execCommand('formatBlock', false, '<blockquote>'); break;
      case 'link': {
        const url = prompt('أدخل عنوان الرابط الإلكتروني (URL):', 'https://');
        if (url) {
          const lowerUrl = url.trim().toLowerCase();
          if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('data:') || lowerUrl.startsWith('vbscript:')) {
            showToast('❌ مخطط الرابط غير مسموح به لأسباب أمنية');
          } else {
            document.execCommand('createLink', false, url);
          }
        }
        break;
      }
    }

    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
    }
  }, [activeField, setContent, showToast]);

  const handleUndo = useCallback(() => {
    if (activeField === 'title') undoTitle();
    else undoContent();
  }, [activeField, undoTitle, undoContent]);

  const handleRedo = useCallback(() => {
    if (activeField === 'title') redoTitle();
    else redoContent();
  }, [activeField, redoTitle, redoContent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag !== 'DIV' && tag !== 'INPUT') return;

      const isMac = navigator.platform.toLowerCase().includes('mac');
      const cmd = isMac ? e.metaKey : e.ctrlKey;
      if (!cmd) return;

      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleUndo, handleRedo]);

  // Memoized derived values
  const currentColorStyle = useMemo(() => 
    COLOR_CLASSES[color] || COLOR_CLASSES.slate, 
    [color]
  );

  const taskReminderCount = useMemo(() => 
    checklist.filter(item => !!item.reminderAt).length, 
    [checklist]
  );

  const reminderPreviewText = useMemo(() => {
    if (!reminderAtInput) return null;
    return formatReminderPreview(fromLocalDateTimeInput(reminderAtInput));
  }, [reminderAtInput]);

  return (
    <div className="fixed inset-0 bg-slate-950 z-30 flex flex-col animate-slideUp select-none overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-slate-400 hover:text-white py-1 pr-1 pl-3 rounded-lg bg-slate-800/60"
        >
          <ArrowRight size={18} />
          <span className="text-xs">رجوع</span>
        </button>

        <span className="text-xs font-bold text-slate-200">
          {note ? 'تعديل الملاحظة' : 'ملاحظة جديدة'}
        </span>

        <button
          onClick={handleSave}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow-md shadow-amber-500/10"
        >
          <Check size={14} className="stroke-[2.5]" />
          <span>حفظ</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => setActiveField('title')}
            placeholder="عنوان الملاحظة..."
            className="w-full bg-transparent text-white text-base font-bold placeholder:text-slate-600 border-b border-slate-800 pb-2 focus:outline-none focus:border-amber-500/60 transition-colors"
          />
        </div>

        <div className="bg-slate-900 p-1 rounded-xl flex items-center gap-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`flex-1 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'text' ? 'bg-slate-800 text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <span>نص الملاحظة</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`flex-1 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all relative ${
              activeTab === 'checklist' ? 'bg-slate-800 text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <CheckSquare size={14} />
            <span>قائمة مهام</span>
            {(checklist.length > 0 || taskReminderCount > 0) && (
              <span className="absolute left-2 min-w-[16px] h-4 px-1 bg-amber-500/20 text-amber-300 text-[9px] rounded-full flex items-center justify-center font-bold">
                {taskReminderCount > 0 ? `${checklist.length}/${taskReminderCount}` : checklist.length}
              </span>
            )}
          </button>
        </div>

        {/* Reminder panel */}
        <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-200">
              <Bell size={15} className="text-amber-400" />
              <span className="text-xs font-bold">التذكيرات والأحداث</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (showReminderPanel) {
                  setShowReminderPanel(false);
                  setReminderAtInput('');
                  setEventEndInput('');
                  setEventLocation('');
                  setEventNote('');
                } else {
                  setShowReminderPanel(true);
                }
              }}
              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                showReminderPanel
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                  : 'bg-slate-800 border-slate-700 text-amber-400 hover:text-white'
              }`}
            >
              {showReminderPanel ? 'إزالة التذكير' : 'إضافة تذكير'}
            </button>
          </div>

          {showReminderPanel && (
            <div className="space-y-3 animate-fadeIn">
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'note', label: 'تذكير للملاحظة', icon: Bell },
                  { id: 'event', label: 'حدث / موعد', icon: CalendarClock },
                ].map(option => {
                  const Icon = option.icon;
                  const active = reminderType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setReminderType(option.id as ReminderType)}
                      className={`py-2 rounded-xl border text-xs flex items-center justify-center gap-1.5 transition-all ${
                        active
                          ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon size={13} />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">تاريخ ووقت التذكير</label>
                  <input
                    type="datetime-local"
                    value={reminderAtInput}
                    onChange={(e) => setReminderAtInput(e.target.value)}
                    className="w-full bg-slate-950 text-slate-100 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                {reminderType === 'event' && (
                  <>
                    <div>
                      <label className="text-[10px] text-slate-500 mb-1 block">نهاية الحدث (اختياري)</label>
                      <input
                        type="datetime-local"
                        value={eventEndInput}
                        onChange={(e) => setEventEndInput(e.target.value)}
                        className="w-full bg-slate-950 text-slate-100 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 mb-1 block">المكان</label>
                      <div className="relative">
                        <MapPin size={13} className="absolute right-3 top-2.5 text-slate-500" />
                        <input
                          type="text"
                          value={eventLocation}
                          onChange={(e) => setEventLocation(e.target.value)}
                          placeholder="مثال: قاعة الاجتماعات / المنزل / أونلاين"
                          className="w-full bg-slate-950 text-slate-100 text-xs rounded-xl pr-9 pl-3 py-2 border border-slate-800 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 mb-1 block">ملاحظات الحدث</label>
                      <input
                        type="text"
                        value={eventNote}
                        onChange={(e) => setEventNote(e.target.value)}
                        placeholder="رابط الاجتماع / معلومات إضافية"
                        className="w-full bg-slate-950 text-slate-100 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </>
                )}
              </div>

              {reminderPreviewText && (
                <div className="text-[10px] text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-xl p-2">
                  {reminderType === 'event' ? '📅' : '⏰'} سيتم التذكير في {reminderPreviewText}
                  {reminderType === 'event' && eventEndInput && (
                    <span> — ينتهي في {formatReminderPreview(fromLocalDateTimeInput(eventEndInput))}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {activeTab === 'text' ? (
          <div className="space-y-3 animate-fadeIn">
            <FormattingToolbar
              onFormat={applyFormat}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={activeField === 'title' ? canUndoTitle : canUndoContent}
              canRedo={activeField === 'title' ? canRedoTitle : canRedoContent}
              isPreview={false}
              onTogglePreview={() => {}}
            />

            <div
              ref={editorRef}
              contentEditable
              onFocus={() => setActiveField('content')}
              onInput={(e) => setContent(e.currentTarget.innerHTML)}
              data-placeholder="اكتب تفاصيل الملاحظة هنا... استخدم شريط التنسيق بالأعلى للتلوين، التكبير، وتعديل الخط مباشرة."
              className="w-full min-h-[240px] bg-slate-900/50 text-slate-100 text-xs rounded-xl p-3.5 border border-slate-800 focus:outline-none focus:border-amber-500/40 leading-relaxed rich-text-editor overflow-y-auto select-text outline-none font-sans"
              style={{ direction: 'rtl' }}
            />

            <p className="text-[10px] text-slate-500 px-1 leading-relaxed">
              💡 نصيحة: حدد أي نص بالأعلى واضغط على أدوات التنسيق لتعديله وتلوينه مباشرة في نفس المكان!
            </p>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 text-amber-400'
                }`}>
                  <Mic size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">الإدخال الصوتي الذكي</h4>
                  <p className="text-[10px] text-slate-400">تحدث ليتم تحويل كلامك لنص</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSimulateVoice}
                disabled={isRecording}
                className="bg-slate-800 hover:bg-slate-700 text-xs text-amber-400 px-2.5 py-1.5 rounded-lg border border-slate-700 font-medium flex items-center gap-1"
              >
                {isRecording ? (
                  <span className="text-rose-400 text-[11px]">يستمع...</span>
                ) : (
                  <>
                    <Sparkles size={12} />
                    <span>تحدث الآن</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 animate-fadeIn">
            <form onSubmit={handleAddChecklist} className="flex gap-1.5">
              <input
                type="text"
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                placeholder="إضافة عنصر جديد للقائمة..."
                className="flex-1 bg-slate-900 text-slate-100 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-amber-500/60 placeholder:text-slate-600"
              />
              <button
                type="submit"
                className="bg-slate-800 text-amber-400 px-3 rounded-xl hover:bg-slate-700 flex items-center justify-center"
              >
                <Plus size={16} />
              </button>
            </form>

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {checklist.length === 0 ? (
                <div className="text-center py-6 text-slate-600 text-xs italic">
                  القائمة فارغة. أضف عناصر جديدة بالأعلى لتتبع إنجازها.
                </div>
              ) : (
                checklist.map((item) => (
                  <div key={item.id} className="bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-800/50 group space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1 select-none">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => toggleChecklist(item.id)}
                          className="rounded border-slate-700 text-amber-500 focus:ring-0 w-4 h-4 bg-slate-800 accent-amber-500"
                        />
                        <span className={`text-xs transition-all ${
                          item.completed ? 'line-through text-slate-500' : 'text-slate-200'
                        }`}>
                          {item.text}
                        </span>
                      </label>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingTaskReminderId(prev => prev === item.id ? null : item.id)}
                          className={`p-1 rounded-lg transition-colors ${item.reminderAt ? 'text-sky-400 bg-sky-500/10' : 'text-slate-500 hover:text-sky-400'}`}
                          title="تذكير للمهمة"
                        >
                          <Bell size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeChecklist(item.id)}
                          className="text-slate-600 hover:text-rose-400 p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {item.reminderAt && (
                      <div className="text-[10px] text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-lg px-2 py-1 flex items-center gap-1.5">
                        <Clock3 size={11} />
                        <span>{formatReminderPreview(item.reminderAt)}</span>
                      </div>
                    )}

                    {editingTaskReminderId === item.id && (
                      <div className="flex items-center gap-1.5 animate-fadeIn">
                        <input
                          type="datetime-local"
                          value={toLocalDateTimeInput(item.reminderAt)}
                          onChange={(e) => setTaskReminder(item.id, e.target.value)}
                          className="flex-1 bg-slate-950 text-slate-100 text-[11px] rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-sky-500/50"
                        />
                        {item.reminderAt && (
                          <button
                            type="button"
                            onClick={() => clearTaskReminder(item.id)}
                            className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                            title="إزالة تذكير المهمة"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {checklist.length > 0 && (
              <div className="text-[10px] text-slate-500 flex justify-between items-center px-1">
                <span>
                  تم إنجاز {checklist.filter(c => c.completed).length} من {checklist.length} · {taskReminderCount} مهام لها تذكير
                </span>
                <button
                  type="button"
                  onClick={() => setChecklist(prev => prev.filter(c => !c.completed))}
                  className="text-amber-500 hover:underline"
                >
                  حذف المكتمل
                </button>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-slate-900 space-y-3">
          <div>
            <label className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mb-1.5">
              <Tag size={12} />
              <span>فئة الملاحظة</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`py-1.5 rounded-xl text-xs text-center transition-all border ${
                    category === cat
                      ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mb-1.5">
              <Palette size={12} />
              <span>لون القالب</span>
            </label>
            <div className="flex items-center gap-2">
              {colors.map((col) => {
                let bgCircle = 'bg-slate-700';
                if (col === 'amber') bgCircle = 'bg-amber-500';
                if (col === 'emerald') bgCircle = 'bg-emerald-500';
                if (col === 'sky') bgCircle = 'bg-sky-500';
                if (col === 'rose') bgCircle = 'bg-rose-500';
                if (col === 'purple') bgCircle = 'bg-purple-500';
                if (col === 'slate') bgCircle = 'bg-slate-600';

                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setColor(col)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${bgCircle} ${
                      color === col ? 'ring-2 ring-white scale-110 shadow-md' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {color === col && <Check size={14} className="text-slate-950 stroke-[3]" />}
                  </button>
                );
              })}

              <div className={`mr-auto px-2.5 py-1 rounded-lg text-[10px] border ${currentColorStyle.bg} ${currentColorStyle.border} ${currentColorStyle.text}`}>
                معاينة اللون
              </div>
            </div>
          </div>
        </div>

        {note && (
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-800"
            >
              <Copy size={13} />
              <span>نسخ الملاحظة</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (navigator.share) {
                  const tempDiv = document.createElement('div');
                  tempDiv.innerHTML = DOMPurify.sanitize(content, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
                  navigator.share({
                    title: title,
                    text: tempDiv.textContent || tempDiv.innerText || ''
                  }).catch(() => showToast('تعذرت المشاركة'));
                } else {
                  handleCopy();
                  showToast('تم نسخ الملاحظة للمشاركة');
                }
              }}
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 px-3 rounded-xl text-xs flex items-center justify-center border border-slate-800"
              title="مشاركة"
            >
              <Share2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
