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
- **النطاق**: `https://research.ehaastore.com` — عام، بلا حماية إضافية
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

## فخاخ معروفة (لا تُعِد اكتشافها)

- ثغرة أمنية معروفة في تبعية `react-router` بالواجهة (GHSA-qwww-vcr4-c8h2) — غير قابلة للاستغلال فعليًا هنا (التطبيق يستخدم `<BrowserRouter>` عادي، ليس وضع RSC المتأثر)، ولا يوجد إصلاح منشور بعد على npm. راقب دوريًا فقط.
- إن أُعيد إنشاء `venv` على الخادم مستقبلاً: تذكّر تثبيت `python3.12-venv` و`python3-pip` أولًا (Ubuntu يفصلهما عن حزمة Python الأساسية).
