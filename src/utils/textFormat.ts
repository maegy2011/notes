/** Result of applying a formatting transform to a textarea */
export interface FormatResult {
  newText: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Wraps the current selection with `before` and `after` markers.
 * If selection is empty, inserts a placeholder.
 */
export function wrapSelection(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string = ''
): FormatResult {
  const selected = text.slice(start, end);
  const middle = selected || placeholder;
  const newText = text.slice(0, start) + before + middle + after + text.slice(end);
  const newStart = start + before.length;
  const newEnd = newStart + middle.length;
  return { newText, selectionStart: newStart, selectionEnd: newEnd };
}

/**
 * Toggles a wrapper around the selection — if already wrapped, unwraps it.
 */
export function toggleWrap(
  text: string,
  start: number,
  end: number,
  marker: string,
  placeholder: string = ''
): FormatResult {
  const selected = text.slice(start, end);
  // Already wrapped? Unwrap.
  if (
    selected.length >= marker.length * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    const newText = text.slice(0, start) + inner + text.slice(end);
    return {
      newText,
      selectionStart: start,
      selectionEnd: start + inner.length,
    };
  }
  return wrapSelection(text, start, end, marker, marker, placeholder);
}

/**
 * Adds a prefix to each line of the selection (e.g. "# " for headings, "- " for lists).
 */
export function prefixLines(
  text: string,
  start: number,
  end: number,
  prefix: string
): FormatResult {
  // Expand selection to full lines
  let lineStart = start;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--;
  let lineEnd = end;
  while (lineEnd < text.length && text[lineEnd] !== '\n') lineEnd++;

  const block = text.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const allHavePrefix = lines.every(l => l.startsWith(prefix));

  const transformed = allHavePrefix
    ? lines.map(l => l.slice(prefix.length)).join('\n')
    : lines.map(l => prefix + l).join('\n');

  const newText = text.slice(0, lineStart) + transformed + text.slice(lineEnd);
  return {
    newText,
    selectionStart: lineStart,
    selectionEnd: lineStart + transformed.length,
  };
}

/**
 * Inserts text at cursor position (no selection wrapping).
 */
export function insertAtCursor(
  text: string,
  start: number,
  end: number,
  insert: string
): FormatResult {
  const newText = text.slice(0, start) + insert + text.slice(end);
  const cursor = start + insert.length;
  return { newText, selectionStart: cursor, selectionEnd: cursor };
}

/* ─────────────────────────────────────────────
   Renderer — converts simple markdown to HTML
   ───────────────────────────────────────────── */

/** Escape HTML to prevent XSS */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Lightweight markdown -> HTML renderer.
 * Supports: # heading, ## heading2, **bold**, *italic*, __underline__,
 * ~~strike~~, `code`, - list items, > quote, [link](url)
 */
export function renderMarkdown(text: string): string {
  if (!text) return '';
  const escaped = escapeHtml(text);

  const lines = escaped.split('\n');
  const out: string[] = [];
  let inList = false;

  const flushList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (let raw of lines) {
    let line = raw;

    // Headings
    if (/^### /.test(line)) {
      flushList();
      out.push(`<h3 class="text-sm font-bold text-white mt-2 mb-1">${inlineFormat(line.replace(/^### /, ''))}</h3>`);
      continue;
    }
    if (/^## /.test(line)) {
      flushList();
      out.push(`<h2 class="text-base font-bold text-white mt-2 mb-1">${inlineFormat(line.replace(/^## /, ''))}</h2>`);
      continue;
    }
    if (/^# /.test(line)) {
      flushList();
      out.push(`<h1 class="text-lg font-extrabold text-white mt-2 mb-1">${inlineFormat(line.replace(/^# /, ''))}</h1>`);
      continue;
    }

    // Quote
    if (/^&gt; /.test(line)) {
      flushList();
      out.push(`<blockquote class="border-r-2 border-amber-500/60 pr-3 my-1 text-slate-300 italic">${inlineFormat(line.replace(/^&gt; /, ''))}</blockquote>`);
      continue;
    }

    // List item
    if (/^- /.test(line) || /^\* /.test(line)) {
      if (!inList) {
        out.push('<ul class="list-disc pr-5 space-y-0.5 my-1">');
        inList = true;
      }
      out.push(`<li>${inlineFormat(line.replace(/^[-*] /, ''))}</li>`);
      continue;
    }

    flushList();

    // Empty line -> paragraph break
    if (line.trim() === '') {
      out.push('<br/>');
    } else {
      out.push(`<p class="my-0.5">${inlineFormat(line)}</p>`);
    }
  }
  flushList();

  return out.join('');
}

/** Inline format: bold, italic, code, links, etc. */
function inlineFormat(s: string): string {
  return s
    // Bold **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
    // Underline __text__
    .replace(/__(.+?)__/g, '<u class="underline decoration-amber-400/60 underline-offset-2">$1</u>')
    // Strike ~~text~~
    .replace(/~~(.+?)~~/g, '<del class="opacity-60">$1</del>')
    // Italic *text* (after bold to avoid clash)
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em class="italic text-slate-200">$2</em>')
    // Code `text`
    .replace(/`([^`]+)`/g, '<code class="bg-slate-700/60 text-amber-300 px-1 py-0.5 rounded text-[10px] font-mono">$1</code>')
    // Link [text](url) — ✅ التحقق من مخطط الروابط لمنع javascript: وغيرها
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text: string, url: string) => {
            const safeUrl = url.trim().toLowerCase();
      // قائمة بيضاء: السماح بـ http و https و mailto و tel فقط
      if (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://') && !safeUrl.startsWith('mailto:') && !safeUrl.startsWith('tel:')) {
        return `<span class="text-rose-400 line-through">${text}</span>`;
      }
      
      const safeUrl = encodeURI(url.trim());
      const safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-sky-400 underline">${safeText}</a>`;
    });
}
