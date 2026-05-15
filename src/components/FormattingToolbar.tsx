import React from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Code, Heading1, Heading2,
  List, Quote, Link as LinkIcon, Undo2, Redo2, Eye, EyeOff
} from 'lucide-react';

export type FormatAction =
  | 'bold' | 'italic' | 'underline' | 'strike' | 'code'
  | 'h1' | 'h2' | 'list' | 'quote' | 'link';

interface FormattingToolbarProps {
  onFormat: (action: FormatAction) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isPreview: boolean;
  onTogglePreview: () => void;
}

const formatBtns: { id: FormatAction; Icon: React.FC<{ size?: number; className?: string }>; title: string }[] = [
  { id: 'bold',      Icon: Bold,         title: 'غامق (Ctrl+B)' },
  { id: 'italic',    Icon: Italic,       title: 'مائل (Ctrl+I)' },
  { id: 'underline', Icon: Underline,    title: 'تسطير (Ctrl+U)' },
  { id: 'strike',    Icon: Strikethrough, title: 'يتوسطه خط' },
  { id: 'code',      Icon: Code,         title: 'كود' },
  { id: 'h1',        Icon: Heading1,     title: 'عنوان رئيسي' },
  { id: 'h2',        Icon: Heading2,     title: 'عنوان فرعي' },
  { id: 'list',      Icon: List,         title: 'قائمة نقطية' },
  { id: 'quote',     Icon: Quote,        title: 'اقتباس' },
  { id: 'link',      Icon: LinkIcon,     title: 'رابط' },
];

export const FormattingToolbar: React.FC<FormattingToolbarProps> = ({
  onFormat, onUndo, onRedo, canUndo, canRedo, isPreview, onTogglePreview
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar select-none">
      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 shrink-0 border-l border-slate-700 pl-1.5 ml-1">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="تراجع (Ctrl+Z)"
          className={`p-1.5 rounded-lg transition-all ${
            canUndo ? 'text-slate-300 hover:text-amber-400 hover:bg-slate-800 active:scale-90'
                    : 'text-slate-700 cursor-not-allowed'
          }`}
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="إعادة (Ctrl+Y)"
          className={`p-1.5 rounded-lg transition-all ${
            canRedo ? 'text-slate-300 hover:text-amber-400 hover:bg-slate-800 active:scale-90'
                    : 'text-slate-700 cursor-not-allowed'
          }`}
        >
          <Redo2 size={14} />
        </button>
      </div>

      {/* Format buttons */}
      <div className="flex items-center gap-0.5 shrink-0">
        {formatBtns.map(({ id, Icon, title }) => (
          <button
            key={id}
            type="button"
            onClick={() => onFormat(id)}
            title={title}
            disabled={isPreview}
            className={`p-1.5 rounded-lg transition-all ${
              isPreview
                ? 'text-slate-700 cursor-not-allowed'
                : 'text-slate-300 hover:text-amber-400 hover:bg-slate-800 active:scale-90'
            }`}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      {/* Preview toggle */}
      <div className="mr-auto shrink-0 flex items-center gap-0.5 border-r border-slate-700 pr-1.5">
        <button
          type="button"
          onClick={onTogglePreview}
          title={isPreview ? 'وضع التحرير' : 'معاينة منسقة'}
          className={`p-1.5 rounded-lg transition-all flex items-center gap-1 ${
            isPreview
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-300 hover:text-amber-400 hover:bg-slate-800'
          }`}
        >
          {isPreview ? <EyeOff size={14} /> : <Eye size={14} />}
          <span className="text-[10px] hidden xs:inline">معاينة</span>
        </button>
      </div>
    </div>
  );
};
