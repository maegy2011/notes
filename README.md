# 📝 ملاحظاتي - Mohafadaty

> تطبيق ويب عربي متكامل لإدارة الملاحظات، المهام، الأحداث، التقويم، وقوائم التسوق — يعمل بالكامل بدون إنترنت.

تطبيق Progressive Web App (PWA) كامل المزايا، يستخدم **SQLite حقيقي** يعمل في المتصفح عبر WebAssembly، مع دعم اختياري لمزامنة سحابية مع **Turso Edge Database**.

---

## ✨ المميزات الرئيسية

| الميزة | الوصف |
|--------|--------|
| 📝 **ملاحظات غنية** | محرر WYSIWYG مع تنسيق نصي حي + Undo/Redo |
| ☑️ **مهام (To-Do)** | أولويات، تواريخ استحقاق، تذكيرات |
| 📅 **أحداث وتقويم** | عرض يومي/أسبوعي/شهري + تكرار |
| 🛒 **قوائم تسوق متقدمة** | فئات، وحدات، ميزانية، تتبع تكلفة |
| 🔔 **تذكيرات شاملة** | للملاحظات، المهام، الأحداث، عناصر القائمة |
| 🔐 **قفل بكلمة مرور** | قفل الكل أو ملاحظات محددة برقم سري |
| 🗑️ **سلة مهملات ذكية** | حذف تلقائي بعد 30 يوماً |
| 🌗 **مظهر متعدد** | فاتح / داكن / تلقائي حسب النظام |
| 💾 **استيراد/تصدير** | ملف JSON كامل (بيانات + إعدادات) |
| 🔄 **مزامنة Turso** | اختيارية، آمنة، عبر LibSQL |
| 📱 **PWA كامل** | قابل للتثبيت على الجوال والحاسوب |

### 🗄️ التخزين المحلي (SQLite WASM)
كل البيانات محفوظة في قاعدة بيانات **SQLite حقيقية** تعمل في المتصفح عبر `sql.js` (WebAssembly). الملف يُخزَّن كـ Base64 blob في `localStorage` — لا خوادم، لا backend، خصوصية كاملة.

### ☁️ المزامنة السحابية الاختيارية (Turso)
دعم اختياري لمزامنة كل البيانات مع **Turso Edge Database** عبر HTTP API الرسمي. تعمل بشكل ثنائي الاتجاه مع دمج ذكي بناءً على آخر وقت تعديل (`updatedAt` timestamp).

---

## 🚀 النشر على Vercel (مجاناً)

### الطريقة الأولى: نشر بنقرة واحدة

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone)

### الطريقة الثانية: عبر Vercel CLI

```bash
# 1. تثبيت Vercel CLI
npm i -g vercel

# 2. تسجيل الدخول
vercel login

# 3. النشر
vercel

# 4. النشر على Production
vercel --prod
```

### الطريقة الثالثة: ربط بمستودع Git

1. ادفع الكود إلى GitHub / GitLab / Bitbucket
2. اذهب إلى [vercel.com/new](https://vercel.com/new)
3. استورد المستودع
4. Vercel سيكتشف Vite تلقائياً ويستخدم الإعدادات من `vercel.json`
5. اضغط **Deploy** ✅

#### الإعدادات التلقائية (من `vercel.json`):
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`
- **Framework:** Vite

---

## 💻 التطوير المحلي

### المتطلبات
- Node.js >= 18
- npm / pnpm / yarn

### التثبيت والتشغيل

```bash
# تثبيت الحزم
npm install

# تشغيل خادم التطوير (http://localhost:5173)
npm run dev

# بناء الإصدار النهائي
npm run build

# معاينة الإصدار النهائي محلياً
npm run preview
```

---

## ⚙️ إعداد مزامنة Turso (اختياري)

### 1. أنشئ قاعدة بيانات مجانية على Turso
```bash
# تثبيت Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# إنشاء حساب
turso auth signup

# إنشاء قاعدة بيانات
turso db create mohafadaty

# الحصول على الرابط HTTP
turso db show mohafadaty --http-url

# إنشاء Auth Token
turso db tokens create mohafadaty
```

### 2. أدخل البيانات في التطبيق
- افتح **الإعدادات** → **مزامنة Turso (اختياري)**
- ألصق الرابط والـ Auth Token
- اضغط **اختبار الاتصال** ثم **مزامنة الآن**
- فعّل **المزامنة التلقائية** للتزامن الفوري مع كل تعديل

> 🔒 جميع البيانات تُحفظ محلياً في متصفحك. Turso يستخدم فقط إذا قمت بإعداده يدوياً.

---

## 📂 بنية المشروع

```
mohafadaty/
├── public/
│   ├── favicon.svg              # أيقونة التطبيق
│   └── manifest.webmanifest     # PWA Manifest
├── src/
│   ├── components/              # كل مكونات React
│   ├── utils/
│   │   ├── sqliteDb.ts          # SQLite WASM Manager
│   │   ├── tursoSync.ts         # مزامنة Turso عبر HTTP
│   │   ├── shareDuplicate.ts    # المشاركة والنسخ
│   │   └── textFormat.ts        # تنسيق النصوص
│   ├── hooks/
│   │   └── useUndoRedo.ts       # نظام التراجع/الإعادة
│   ├── data/
│   │   └── initialNotes.ts      # ملاحظات نموذجية
│   ├── types.ts                 # تعريفات TypeScript
│   ├── App.tsx                  # المكون الرئيسي
│   ├── main.tsx                 # نقطة الدخول
│   └── index.css                # تنسيقات Tailwind + مخصصة
├── index.html                   # قالب HTML مع SEO/PWA
├── vercel.json                  # إعدادات Vercel
├── vite.config.ts               # إعدادات Vite
├── tsconfig.json                # إعدادات TypeScript
└── package.json
```

---

## 🛠️ التقنيات المستخدمة

- **React 19** + **TypeScript 5**
- **Vite 7** (مع `vite-plugin-singlefile` لإنتاج ملف HTML واحد)
- **Tailwind CSS 4** للتصميم
- **sql.js** — SQLite حقيقي عبر WebAssembly
- **Turso (LibSQL)** — قاعدة بيانات Edge اختيارية
- **Lucide React** — أيقونات SVG عصرية
- **Google Fonts (Cairo)** — خط عربي أنيق

---

## 🔒 الخصوصية والأمان

- ✅ **لا backend، لا خوادم خاصة بنا** — كل شيء يحدث في متصفحك.
- ✅ **بيانات SQLite مشفرة محلياً** بـ Base64 في localStorage.
- ✅ **قفل التطبيق** برقم سري PIN (4 أرقام) محفوظ في localStorage.
- ✅ **مزامنة Turso اختيارية** — لا تُفعّل إلا بإدخال بياناتك يدوياً.
- ✅ **Headers أمان** مفعّلة (`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).

---

## 📜 الترخيص

MIT License — حرية كاملة للاستخدام الشخصي والتجاري.

---

## 💛 صنع بكل حب لإدارة أفكارك بكفاءة
