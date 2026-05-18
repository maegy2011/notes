export interface FormatResult {
  newText: string;
  selectionStart: number;
  selectionEnd: number;
}

export function wrapSelection(text: string, start: number, end: number, before: string, after: string, placeholder: string = ''): FormatResult {
  const selected = text.slice(start, end);
  const middle = selected || placeholder;
  const newText = text.slice(0, start) + before + middle + after + text.slice(end);
  return { newText, selectionStart: start + before.length, selectionEnd: start + before.length + middle.length };
}

export function toggleWrap(text: string, start: number, end: number, marker: string, placeholder: string = ''): FormatResult {
  const selected = text.slice(start, end);
  if (selected.length >= marker.length * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    return { newText: text.slice(0, start) + inner + text.slice(end), selectionStart: start, selectionEnd: start + inner.length };
  }
  return wrapSelection(text, start, end, marker, marker, placeholder);
}

export function prefixLines(text: string, start: number, end: number, prefix: string): FormatResult {
  let lineStart = start;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--;
  let lineEnd = end;
  while (lineEnd < text.length && text[lineEnd] !== '\n') lineEnd++;
  const block = text.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const allHavePrefix = lines.every(l => l.startsWith(prefix));
  const transformed = allHavePrefix ? lines.map(l => l.slice(prefix.length)).join('\n') : lines.map(l => prefix + l).join('\n');
  return { newText: text.slice(0, lineStart) + transformed + text.slice(lineEnd), selectionStart: lineStart, selectionEnd: lineStart + transformed.length };
}

export function insertAtCursor(text: string, start: number, end: number, insert: string): FormatResult {
  const newText = text.slice(0, start) + insert + text.slice(end);
  return { newText, selectionStart: start + insert.length, selectionEnd: start + insert.length };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function renderMarkdown(text: string): string {
  if (!text) return '';
  const escaped = escapeHtml(text);
  const lines = escaped.split('\n');
  const out: string[] = [];
  let inList = false;
  const flushList = () => { if (inList) { out.push('</ul>'); inList = false; } };

  for (let raw of lines) {
    let line = raw;
    if (/^### /.test(line)) { flushList(); out.push(`<h3 class="text-sm font-bold text-white mt-2 mb-1">${inlineFormat(line.replace(/^### /, ''))}</h3>`); continue; }
    if (/^## /.test(line)) { flushList(); out.push(`<h2 class="text-base font-bold text-white mt-2 mb-1">${inlineFormat(line.replace(/^## /, ''))}</h2>`); continue; }
    if (/^# /.test(line)) { flushList(); out.push(`<h1 class="text-lg font-extrabold text-white mt-2 mb-1">${inlineFormat(line.replace(/^# /, ''))}</h1>`); continue; }
    if (/^&gt; /.test(line)) { flushList(); out.push(`<blockquote class="border-r-2 border-amber-500/60 pr-3 my-1 text-slate-300 italic">${inlineFormat(line.replace(/^&gt; /, ''))}</blockquote>`); continue; }
    if (/^- /.test(line) || /^\* /.test(line)) {
      if (!inList) { out.push('<ul class="list-disc pr-5 space-y-0.5 my-1">'); inList = true; }
      out.push(`<li>${inlineFormat(line.replace(/^[-*] /, ''))}</li>`); continue;
    }
    flushList();
    if (line.trim() === '') out.push('<br/>'); else out.push(`<p class="my-0.5">${inlineFormat(line)}</p>`);
  }
  flushList();
  return out.join('');
}

function inlineFormat(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
    .replace(/__(.+?)__/g, '<u class="underline decoration-amber-400/60 underline-offset-2">$1</u>')
    .replace(/~~(.+?)~~/g, '<del class="opacity-60">$1</del>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em class="italic text-slate-200">$2</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-700/60 text-amber-300 px-1 py-0.5 rounded text-[10px] font-mono">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text: string, url: string) => {
      const lowerUrl = url.trim().toLowerCase();
      // منع تشغيل سكربتات خبيثة (XSS)
      if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://') && !lowerUrl.startsWith('mailto:') && !lowerUrl.startsWith('tel:')) {
        return `<span class="text-rose-400 line-through">${text}</span>`;
      }
      const safeUrl = encodeURI(url.trim());
      const safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-sky-400 underline">${safeText}</a>`;
    });
}