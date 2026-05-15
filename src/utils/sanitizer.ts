/**
 * Safe HTML Sanitizer Module
 * 
 * Provides XSS protection by sanitizing user-input HTML
 * Uses DOMPurify for robust HTML sanitization
 * 
 * Installation:
 * npm install dompurify
 * npm install --save-dev @types/dompurify
 */

import DOMPurify from 'dompurify';

/**
 * Safe tags allowed in rich text notes
 */
const ALLOWED_TAGS = [
  'b', 'i', 'em', 'strong', 'u',
  'p', 'br',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3',
  'blockquote',
  'code', 'pre',
  'a', // مع التحكم في الـ href
];

const ALLOWED_ATTRIBUTES = {
  'a': ['href', 'title', 'target'],
  '*': ['style'], // فقط الـ inline styles المسموحة
};

/**
 * Configure DOMPurify with security settings
 */
const config = {
  ALLOWED_TAGS,
  ALLOWED_ATTR: ALLOWED_ATTRIBUTES,
  KEEP_CONTENT: true,
  RETURN_DOM: false,
  FORCE_BODY: false,
  SANITIZE_DOM: true,
  ISOLATED: true, // منع الوصول إلى النطاق الخارجي
};

/**
 * Sanitize HTML input to prevent XSS attacks
 * 
 * @param html - Raw HTML string from user input
 * @returns - Sanitized HTML safe to render
 * 
 * @example
 * const userContent = '<b>Safe</b><script>alert("XSS")</script>';
 * const safe = sanitizeHtml(userContent);
 * // Output: '<b>Safe</b>'
 */
export const sanitizeHtml = (html: string): string => {
  if (!html || typeof html !== 'string') return '';
  
  try {
    // تعقيم HTML
    let clean = DOMPurify.sanitize(html, config);
    
    // تطبيق تحكم إضافي على الروابط
    clean = sanitizeLinks(clean);
    
    return clean;
  } catch (error) {
    console.error('[Sanitizer] Error sanitizing HTML:', error);
    return ''; // في حالة الخطأ، أرجع نص فارغ (آمن)
  }
};

/**
 * Remove all HTML tags and return plain text
 * This is more restrictive than sanitizeHtml
 * 
 * @param html - HTML string
 * @returns - Plain text without any HTML
 */
export const stripAllHtml = (html: string): string => {
  if (!html || typeof html !== 'string') return '';
  
  try {
    // إزالة جميع الـ tags
    const clean = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });
    
    return clean.trim();
  } catch (error) {
    console.error('[Sanitizer] Error stripping HTML:', error);
    return '';
  }
};

/**
 * Sanitize links to prevent javascript: and data: protocols
 * 
 * @param html - HTML string with potential unsafe links
 * @returns - HTML with sanitized links
 */
const sanitizeLinks = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  
  // البحث عن جميع الروابط
  const links = div.querySelectorAll('a[href]');
  
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    
    // منع javascript: و data: و غيرها
    if (/^(javascript|data|vbscript):/i.test(href)) {
      link.removeAttribute('href'); // إزالة الـ href الخطير
      link.setAttribute('href', '#'); // استبدال بـ href آمن
    }
    
    // فتح الروابط في تبويب جديد
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer'); // منع تجاوز الحماية
  });
  
  return div.innerHTML;
};

/**
 * Validate user input before processing
 * 
 * @param input - User input string
 * @param maxLength - Maximum allowed length (default: 100000)
 * @returns - Boolean indicating if input is valid
 */
export const isValidUserInput = (input: string, maxLength: number = 100000): boolean => {
  if (typeof input !== 'string') return false;
  if (input.length === 0) return true; // فارغ مقبول
  if (input.length > maxLength) return false; // أكبر من الحد الأقصى
  
  // فحص نمط (regex) للمحتوى المريب
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // event handlers مثل onclick=
    /eval\(/i,
    /expression\(/i,
  ];
  
  return !suspiciousPatterns.some(pattern => pattern.test(input));
};

/**
 * Safely create a DOM element from HTML string
 * 
 * @param html - HTML string
 * @returns - Safe DOM element
 */
export const createSafeDomElement = (html: string): HTMLElement => {
  const div = document.createElement('div');
  div.innerHTML = sanitizeHtml(html);
  return div;
};

/**
 * XSS Detection Utility
 * 
 * Detects potential XSS payloads in user input
 */
export const xssDetector = {
  /**
   * Check if string contains potential XSS payload
   */
  containsXss: (str: string): boolean => {
    const xssPatterns = [
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<embed[^>]*>/gi,
      /<object[^>]*>/gi,
    ];
    
    return xssPatterns.some(pattern => pattern.test(str));
  },

  /**
   * Get type of XSS attack detected
   */
  detectXssType: (str: string): string | null => {
    if (/<script/i.test(str)) return 'Stored XSS';
    if (/javascript:/i.test(str)) return 'Protocol-based XSS';
    if (/on\w+\s*=/i.test(str)) return 'Event Handler XSS';
    if (/<iframe/i.test(str)) return 'Frame Injection';
    if (/eval\(/i.test(str)) return 'Code Evaluation';
    return null;
  },
};
