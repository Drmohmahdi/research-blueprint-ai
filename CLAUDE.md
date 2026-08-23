# Research Blueprint AI (بصيرة) — سياق النشر والبنية التحتية

هذا الملف يُحمَّل تلقائيًا في أي جلسة Claude Code تُفتح على هذا المجلد. الهدف: أي جلسة تطوير محلي تعرف تلقائيًا كيف يعمل النشر، دون إعادة شرحه.

**ملاحظة معمارية مهمة**: هذه المنصة الوحيدة من بين المنصات الست ذات بنية مزدوجة — واجهة React منفصلة تمامًا عن خلفية Python/FastAPI، تُنشران كعمليتين مستقلتين خلف نفس النطاق.

## دورة النشر

1. التطوير والتعديل يتم محليًا في هذا المجلد فقط (الواجهة في `src/`، الخلفية في `backend/`).
2. **قبل أي `git push`**:
   - الواجهة: `npm run build`
   - الخلفية: `cd backend && python -m pytest app/tests` (إن كانت البيئة الافتراضية `venv` مُفعَّلة محليًا)
3. `git push origin main` يُشغّل تلقائيًا GitHub Actions (`.github/workflows/deploy-hostinger.yml`) الذي: يبني الواجهة، ثم يُفعّل `venv` على الخادم ويُثبّت `requirements.txt` ويُطبّق هجرات Alembic (`python -m alembic upgrade head`)، ثم `pm2 reload ecosystem.config.cjs --update-env` لكلتا العمليتين معًا.
4. **لا يُنشر تلقائيًا بدون دفعك أنت**.
5. **بعد النشر**: تحقق من `https://status.ehaastore.com` (Uptime Kuma) — المراقب يفحص `/health` (نقطة صحة الخلفية الفعلية).

## معلومات النشر الحالية (بدون أسرار)

- **GitHub**: `Drmohmahdi/research-blueprint-ai` (فرع `main`)
- **النطاق**: `https://research.ehaastore.com` — ⚠️ محمي مؤقتًا بكلمة مرور على مستوى Traefik (HTTP Basic Auth) لحين انتهاء التطوير الحالي — راجع قسم "حماية التطوير المؤقتة" أدناه قبل افتراض أن الموقع عام
- **الخادم**: Hostinger VPS، المسار `/var/www/research-blueprint-ai`
- **عمليتا PM2**:
  - `research-frontend` (منفذ `3004`) — خادم ملفات ثابتة مخصَّص بلا أي تبعيات (`server/static-server.mjs`)، وليس حزمة `serve` (استُبعِدت عمدًا لثغرة DoS في تبعياتها الفرعية `brace-expansion`)
  - `research-backend` (منفذ `3005`) — FastAPI عبر `backend/start.sh` (يُفعّل `venv` ثم `uvicorn`)
- **التوجيه (Traefik)**: مسارا `/api` و`/ws` و`/health` و`/ready` → الخلفية (3005)، وكل شيء آخر → الواجهة (3004) — راجع `/root/traefik-dynamic/research-blueprint-ai.yml` على الخادم
- **قاعدة البيانات**: PostgreSQL داخل حاوية `wathaq_postgres` المشتركة (قاعدة `research_blueprint`، مستخدم مستقل بنفس الاسم) — منقولة من Neon الأصلية، مع استبعاد الجداول التي تزرعها الهجرات نفسها افتراضيًا (`plans`, `users` الافتراضي) لتفادي تعارض المفاتيح الأساسية
- **بيئة Python**: `venv` منفصلة على الخادم داخل `backend/venv` — **غير متتبَّعة في Git**، يجب أن تبقى موجودة على الخادم دائمًا (لا تُحذف)
- **الذكاء الاصطناعي**: Google Gemini (اختياري — يعمل التطبيق بمحرّك قواعد احتياطي بدونه)
- **Node.js على الخادم**: 22.x (للواجهة فقط، الخلفية بايثون منفصلة تمامًا)
- **نسخ احتياطي**: يومي تلقائي عبر `/root/backups/backup-databases.sh` على الخادم
- **مراقبة**: مُضافة في Uptime Kuma (`status.ehaastore.com`)

## حماية التطوير المؤقتة (Traefik Basic Auth)

بتاريخ 2026-08-24 أُضيفت طبقة حماية مؤقتة بكلمة مرور على مستوى Traefik لإخفاء الموقع عن الجمهور أثناء التطوير النشط الحالي — **لا علاقة لها بتسجيل الدخول الفعلي للتطبيق**، وهي طبقة إضافية أمامه بالكامل.

- **الآلية**: middleware باسم `research-dev-gate` (نوع `basicAuth`) في `/root/traefik-dynamic/research-blueprint-ai.yml` على الخادم، مُطبَّق على راوتري `research-frontend` و`research-backend`.
- **استُثنيت عمدًا من الحماية**: `/health` و`/ready` فقط (عبر راوتر منفصل `research-health` بأولوية أعلى) — حتى تستمر مراقبة Uptime Kuma (`status.ehaastore.com`) بالعمل دون كسر.
- **اسم المستخدم**: `baseerah-dev` — **كلمة المرور**: أُرسلت للمستخدم مباشرة في المحادثة وليست مخزَّنة في هذا الملف أو أي ملف متتبَّع بـ Git (تجنبًا لتسريبها عبر GitHub). إن فُقدت، أعد توليدها على الخادم بـ: `htpasswd -nbB baseerah-dev '<كلمة-مرور-جديدة>'` ثم استبدل السطر داخل `users:` في ملف الـ middleware، لا حاجة لإعادة تشغيل أي شيء (Traefik file provider يعيد التحميل تلقائيًا عند تعديل الملف).
- **نسخة احتياطية من الإعداد الأصلي** (بلا حماية): `/root/traefik-dynamic/research-blueprint-ai.yml.bak-20260824012657` على الخادم.
- **لإزالة الحماية عند انتهاء التطوير**: استرجع النسخة الاحتياطية أعلاه فوق الملف الحالي (أو احذف سطري `middlewares:` من الراوترين `research-frontend`/`research-backend` وأعد دمج راوتر `/health`+`/ready` مع `research-backend` كما كانا قبل هذا التعديل) — لا حاجة لإعادة نشر الكود أو إعادة تشغيل PM2، التعديل في ملف Traefik وحده كافٍ.

## فخاخ معروفة (لا تُعِد اكتشافها)

- ثغرة أمنية معروفة في تبعية `react-router` بالواجهة (GHSA-qwww-vcr4-c8h2) — غير قابلة للاستغلال فعليًا هنا (التطبيق يستخدم `<BrowserRouter>` عادي، ليس وضع RSC المتأثر)، ولا يوجد إصلاح منشور بعد على npm. راقب دوريًا فقط.
- إن أُعيد إنشاء `venv` على الخادم مستقبلاً: تذكّر تثبيت `python3.12-venv` و`python3-pip` أولًا (Ubuntu يفصلهما عن حزمة Python الأساسية).
- `backend/app/config.py: Settings.validate_production()` يرفض الإقلاع في `ENVIRONMENT=production` إن كانت `APP_URL` بدون `https://` أو `TRUSTED_HOSTS` غير مضبوطة (تنكمش تلقائيًا إلى `localhost,127.0.0.1` إن غابت، فيرفض FastAPI's `TrustedHostMiddleware` أي طلب حقيقي عبر Traefik حتى لو نجح الإقلاع). ملف `.env` الفعلي على الخادم (`/var/www/research-blueprint-ai/backend/.env`) يجب أن يحتوي دائمًا: `APP_URL=https://research.ehaastore.com` و `TRUSTED_HOSTS=research.ehaastore.com` — راجع `.env.production.example` كمرجع كامل. إن أُعيد إنشاء هذا الملف من نسخة احتياطية قديمة أو من الصفر، تحقق من وجود هذين المتغيرين تحديدًا قبل إعادة التشغيل، وإلا ستدخل `research-backend` في حلقة إعادة تشغيل (`pm2 list` يُظهر `↺` مرتفعًا و`uptime: 0s`).
