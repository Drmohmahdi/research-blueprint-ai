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
- **النطاق**: `https://research.ehaastore.com` — ⚠️ محمي مؤقتًا بشاشة دخول مخصَّصة (هوية المنصة) بكلمة مرور واحدة مشتركة لحين انتهاء التطوير الحالي — راجع قسم "حماية التطوير المؤقتة" أدناه قبل افتراض أن الموقع عام
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

## حماية التطوير المؤقتة (شاشة دخول مخصَّصة على مستوى التطبيق)

بتاريخ 2026-08-24 أُضيفت طبقة حماية مؤقتة لإخفاء الموقع عن الجمهور أثناء التطوير النشط الحالي — **لا علاقة لها بتسجيل الدخول الفعلي للتطبيق** (`/api/auth/*`)، وهي طبقة إضافية أمامه بالكامل. استُبدلت بها محاولة أولى استخدمت Traefik Basic Auth (نافذة المتصفح الأصلية) لأنها ظهرت كنافذة نظام قبيحة غير متوافقة مع هوية المنصة.

- **الآلية**: كلمة مرور واحدة مشتركة (`SITE_GATE_PASSWORD` في `backend/.env` على الخادم فقط، غير متتبَّعة بـ Git) يُشتق منها رمز SHA-256 ثابت (`backend/app/services/site_gate.py`)، يُخزَّن في كوكي `baseerah_gate` (HttpOnly، 30 يومًا) بعد نجاح `POST /api/site-gate/verify`.
  - **الخلفية (FastAPI)**: middleware عام في `backend/app/main.py` يرفض أي طلب بلا الكوكي الصحيح برمز 401 `{"detail": "SITE_GATED"}`، باستثناء `/health` و`/ready` و`/readiness` و`/api/site-gate/status` و`/api/site-gate/verify` — حتى تستمر مراقبة Uptime Kuma بالعمل.
  - **الواجهة (`server/static-server.mjs`)**: يحسب نفس رمز SHA-256 من نفس المتغير (يصل إليه عبر قراءة `backend/.env` مباشرة داخل `ecosystem.config.cjs`، دون تكرار السر في ملف منفصل) ويعرض صفحة `server/gate.html` المستقلة (بهوية المنصة البصرية — خلفية داكنة، تدرّج تركوازي، RTL) بدل أي ملف فعلي إن كانت الكوكي مفقودة أو خاطئة، فلا يصل أي طلب لملفات الواجهة الحقيقية بلا كلمة المرور.
- **كلمة المرور الحالية**: أُرسلت للمستخدم مباشرة في المحادثة وليست مخزَّنة في هذا الملف أو أي ملف متتبَّع بـ Git. لتغييرها: عدّل `SITE_GATE_PASSWORD` في `backend/.env` على الخادم ثم `pm2 reload ecosystem.config.cjs --update-env` (يُعيد تشغيل العمليتين معًا فيتزامن الرمز في الطرفين).
- **لإزالة الحماية عند انتهاء التطوير**: احذف سطر `SITE_GATE_PASSWORD` من `backend/.env` على الخادم ثم `pm2 reload ecosystem.config.cjs --update-env` — الحماية تُعطَّل تلقائيًا بغياب المتغير في الطرفين، دون أي تعديل على الكود نفسه.
- **ملاحظة Traefik**: أُعيد ملف `/root/traefik-dynamic/research-blueprint-ai.yml` على الخادم إلى حالته الأصلية بلا أي `middlewares` — لا حاجة لأي تعديل هناك بعد الآن.

## فخاخ معروفة (لا تُعِد اكتشافها)

- كانت هناك ثغرة معروفة سابقًا في تبعية `react-router` (GHSA-qwww-vcr4-c8h2) — تأكدت في 2026-08-28 عبر `npm audit` أنها لم تعد تظهر إطلاقًا (0 ثغرات)، على الأرجح لتحديث تلقائي لنسخة `react-router` تجاوز النطاق المتأثر. لا حاجة لأي إجراء إضافي.
- إن أُعيد إنشاء `venv` على الخادم مستقبلاً: تذكّر تثبيت `python3.12-venv` و`python3-pip` أولًا (Ubuntu يفصلهما عن حزمة Python الأساسية).
- `backend/app/config.py: Settings.validate_production()` يرفض الإقلاع في `ENVIRONMENT=production` إن كانت `APP_URL` بدون `https://` أو `TRUSTED_HOSTS` غير مضبوطة (تنكمش تلقائيًا إلى `localhost,127.0.0.1` إن غابت، فيرفض FastAPI's `TrustedHostMiddleware` أي طلب حقيقي عبر Traefik حتى لو نجح الإقلاع). ملف `.env` الفعلي على الخادم (`/var/www/research-blueprint-ai/backend/.env`) يجب أن يحتوي دائمًا: `APP_URL=https://research.ehaastore.com` و `TRUSTED_HOSTS=research.ehaastore.com` — راجع `.env.production.example` كمرجع كامل. إن أُعيد إنشاء هذا الملف من نسخة احتياطية قديمة أو من الصفر، تحقق من وجود هذين المتغيرين تحديدًا قبل إعادة التشغيل، وإلا ستدخل `research-backend` في حلقة إعادة تشغيل (`pm2 list` يُظهر `↺` مرتفعًا و`uptime: 0s`).
