import { Note } from '../types';

export const INITIAL_NOTES: Note[] = [
  {
    id: '1',
    title: '🚀 فكرة تطبيق جوال جديد',
    content: 'تطبيق يركز على مساعدة المستقلين (Freelancers) في تتبع وقتهم وإصدار الفواتير تلقائياً للعملاء باللغة العربية، مع ميزة التذكير عبر واتساب.',
    category: 'ideas',
    color: 'amber',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    isPinned: true,
    isFavorite: true,
    isArchived: false,
    isTrash: false,
    isLocked: false,
    checklist: [
      { id: 'c1', text: 'رسم الواجهات المبدئية (Wireframes)', completed: true },
      { id: 'c2', text: 'دراسة واجهات برمجة التطبيقات للبنوك المحلية', completed: false },
      { id: 'c3', text: 'حجز النطاق (Domain name)', completed: false }
    ]
  },
  {
    id: '2',
    title: '💼 مهام اجتماع إطلاق المنتج',
    content: 'مراجعة خطة التسويق مع فريق السوشيال ميديا، والتأكد من جاهزية سيرفرات الاستضافة لاستقبال الزيارات العالية المتوقعة يوم الأحد القادم.',
    category: 'work',
    color: 'sky',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    isPinned: true,
    isFavorite: false,
    isArchived: false,
    isTrash: false,
    isLocked: false,
    checklist: [
      { id: 'w1', text: 'إرسال جدول الأعمال للمشاركين', completed: true },
      { id: 'w2', text: 'تجهيز العرض التقديمي (Slides)', completed: true },
      { id: 'w3', text: 'تأكيد حضور المدير التقني', completed: true }
    ]
  },
  {
    id: '3',
    title: '🛒 قائمة التسوق الأسبوعية',
    content: 'شراء الأغراض الأساسية للمنزل من السوبرماركت قبل عطلة نهاية الأسبوع لتجنب الازدحام.',
    category: 'personal',
    color: 'emerald',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    isPinned: false,
    isFavorite: true,
    isArchived: false,
    isTrash: false,
    isLocked: false,
    checklist: [
      { id: 'p1', text: 'حليب خالي الدسم (عدد 2)', completed: true },
      { id: 'p2', text: 'قهوة مختصة (بن إثيوبي)', completed: false },
      { id: 'p3', text: 'خضروات طازجة للسلطة', completed: true },
      { id: 'p4', text: 'خبز أسمر للدايت', completed: false }
    ]
  },
  {
    id: '4',
    title: '📚 ملخص كتاب "العادات الذرية"',
    content: 'النجاح هو نتاج عادات يومية بسيطة تتراكم بمرور الوقت وليست تحولات جذرية تحدث مرة واحدة. ركز على تحسين 1% كل يوم لتحقيق نتائج مذهلة على المدى الطويل.',
    category: 'study',
    color: 'purple',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    isPinned: false,
    isFavorite: true,
    isArchived: false,
    isTrash: false,
    isLocked: false
  },
  {
    id: '5',
    title: '💡 اقتباسات ملهمة للعمل',
    content: '"الطريقة الوحيدة لإنجاز عمل عظيم هي أن تحب ما تفعله." - ستيف جوبز\n\n"لا تنتظر الفرصة، بل اصنعها بنفسك."',
    category: 'ideas',
    color: 'rose',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    isPinned: false,
    isFavorite: false,
    isArchived: false,
    isTrash: false,
    isLocked: false
  },
  {
    id: '6',
    title: '🗄️ ملاحظة مؤرشفة قديمة',
    content: 'بيانات حساب الاستضافة القديم الذي تم نقله في عام 2024. تم الاحتفاظ بهذه الملاحظة للرجوع إليها عند الحاجة.',
    category: 'personal',
    color: 'slate',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 500).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 500).toISOString(),
    isPinned: false,
    isFavorite: false,
    isArchived: true,
    isTrash: false,
    isLocked: false
  }
];

export const CATEGORY_LABELS: Record<string, string> = {
  all: 'الكل',
  work: 'العمل',
  personal: 'شخصي',
  ideas: 'أفكار',
  study: 'دراسة'
};

export const COLOR_CLASSES: Record<string, { bg: string, border: string, text: string, badgeBg: string, badgeText: string }> = {
  amber: {
    bg: 'bg-amber-500/10 hover:bg-amber-500/15',
    border: 'border-amber-500/30',
    text: 'text-amber-200',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300'
  },
  emerald: {
    bg: 'bg-emerald-500/10 hover:bg-emerald-500/15',
    border: 'border-emerald-500/30',
    text: 'text-emerald-200',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300'
  },
  sky: {
    bg: 'bg-sky-500/10 hover:bg-sky-500/15',
    border: 'border-sky-500/30',
    text: 'text-sky-200',
    badgeBg: 'bg-sky-500/20',
    badgeText: 'text-sky-300'
  },
  rose: {
    bg: 'bg-rose-500/10 hover:bg-rose-500/15',
    border: 'border-rose-500/30',
    text: 'text-rose-200',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-300'
  },
  purple: {
    bg: 'bg-purple-500/10 hover:bg-purple-500/15',
    border: 'border-purple-500/30',
    text: 'text-purple-200',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-300'
  },
  slate: {
    bg: 'bg-slate-800 hover:bg-slate-750',
    border: 'border-slate-700',
    text: 'text-slate-200',
    badgeBg: 'bg-slate-700',
    badgeText: 'text-slate-300'
  }
};
