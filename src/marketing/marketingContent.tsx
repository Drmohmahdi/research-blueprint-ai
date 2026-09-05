import {
  FlaskConical, BookOpen, Award, Briefcase, FileCheck2,
  ShieldCheck, GraduationCap, BarChart3, GitBranch, Crown,
  Users, Building2, Scale,
} from 'lucide-react';

export const NAV = [
  { to: '/features', ar: 'المميزات', en: 'Features' },
  { to: '/solutions', ar: 'الحلول', en: 'Solutions' },
  { to: '/how-it-works', ar: 'كيف تعمل', en: 'How it works' },
  { to: '/pricing', ar: 'الباقات', en: 'Pricing' },
  { to: '/faq', ar: 'الأسئلة', en: 'FAQ' },
  { to: '/about', ar: 'عن المنصة', en: 'About' },
  { to: '/institutional', ar: 'للجامعات', en: 'Universities' },
  { to: '/contact', ar: 'تواصل', en: 'Contact' },
] as const;

export const PAGE_SEO: Record<string, { titleAr: string; titleEn: string; descAr: string; descEn: string }> = {
  '/': {
    titleAr: 'بصيرة — منصة دورة البحث العلمي للجامعات والباحثين',
    titleEn: 'Baseerah — Academic research lifecycle platform',
    descAr: 'منصة سعودية سحابية لتصميم الدراسات، التحليل الإحصائي، التحكيم مزدوج التعمية، الترقيات الأكاديمية، والرسائل الجامعية — بقرارات بشرية وذكاء اصطناعي محكوم.',
    descEn: 'Saudi academic SaaS for study design, statistics, double-blind peer review, promotion dossiers, and thesis operations — with human decisions and governed AI.',
  },
  '/features': {
    titleAr: 'مميزات بصيرة — دورة البحث كاملة في منصة واحدة',
    titleEn: 'Baseerah features — the full research lifecycle',
    descAr: 'ست وحدات متكاملة: تصميم الدراسات، الأدبيات والميتا، التحكيم، الترقيات، الظهور الأكاديمي، والذكاء الاصطناعي الحوكمي.',
    descEn: 'Six modules: study design, literature and meta-analysis, peer review, promotions, academic visibility, and governed AI.',
  },
  '/solutions': {
    titleAr: 'حلول بصيرة حسب دورك الأكاديمي',
    titleEn: 'Baseerah solutions by academic role',
    descAr: 'مسارات واضحة للباحث، طالب الدراسات العليا، المشرف، المجموعة البحثية، عمادة الدراسات العليا، ولجان الترقيات.',
    descEn: 'Clear paths for researchers, graduate students, supervisors, research groups, graduate studies offices, and promotion committees.',
  },
  '/how-it-works': {
    titleAr: 'كيف تعمل بصيرة — من التسجيل إلى التقرير المعتمد',
    titleEn: 'How Baseerah works',
    descAr: 'أربع خطوات: صمّم دراستك، حلّل وادمج الأدبيات، راجع وانشر، ثم جهّز الترقية والحضور الأكاديمي.',
    descEn: 'Four steps: design the study, analyze and synthesize, review and publish, then prepare promotion and visibility.',
  },
  '/pricing': {
    titleAr: 'باقات بصيرة — مجانية، باحث، فرق، ومؤسسات',
    titleEn: 'Baseerah pricing — Free, Starter, Professional, Institutional',
    descAr: 'ابدأ مجانًا بثلاثة مشاريع. ارتقِ حسب حجم الفريق والتحكيم والترقيات. أسعار شهرية وسنوية بالريال السعودي.',
    descEn: 'Start free with three projects. Upgrade by team size, peer review, and promotions. Monthly and annual SAR pricing.',
  },
  '/faq': {
    titleAr: 'الأسئلة الشائعة — بصيرة للبحث العلمي',
    titleEn: 'Baseerah FAQ',
    descAr: 'إجابات عن الباحثين المستقلين، الجامعات، خصوصية التحكيم، ودور الذكاء الاصطناعي، والدفع والاشتراك.',
    descEn: 'Answers on independent researchers, universities, review privacy, AI limits, and subscriptions.',
  },
  '/about': {
    titleAr: 'عن بصيرة — جودة أكاديمية سعودية',
    titleEn: 'About Baseerah — Saudi academic premium',
    descAr: 'بصيرة منصة تشغيل أكاديمي وليست مولّد أوراق. تُبقي القرار البشري، وتعزل بيانات كل مؤسسة، وتعمل بالعربية والإنجليزية.',
    descEn: 'Baseerah is an academic operations platform, not a paper generator. Humans decide, tenants stay isolated, and Arabic and English are first-class.',
  },
  '/contact': {
    titleAr: 'تواصل مع بصيرة — عرض مؤسسي أو تجربة',
    titleEn: 'Contact Baseerah — demo or institutional inquiry',
    descAr: 'اطلب عرضًا للجامعة أو الكلية، أو اسأل عن باقة الفرق، أو تواصل للدعم.',
    descEn: 'Request a university demo, ask about the research-group plan, or contact support.',
  },
  '/institutional': {
    titleAr: 'عرض بصيرة للكليات وعمادات الدراسات العليا',
    titleEn: 'Baseerah brief for colleges and graduate offices',
    descAr: 'موجز تشغيلي للجامعات: عزل بيانات، رسائل جامعية، تحكيم وترقيات — عبر طلب عرض لا بطاقة.',
    descEn: 'An operational brief for universities: tenant isolation, thesis operations, review and promotions — via a demo request, not a card checkout.',
  },
};

export const FEATURES = [
  {
    icon: <FlaskConical size={22} />,
    titleAr: 'تصميم الدراسات البحثية',
    titleEn: 'Research study design',
    descAr: 'منهجيات تجريبية وارتباطية وتنبؤية مع حاسبات حجم العينة والقوة الإحصائية ومخطط التحليل.',
    descEn: 'Experimental, correlational, and predictive designs with sample-size, power, and analysis-plan tools.',
  },
  {
    icon: <BookOpen size={22} />,
    titleAr: 'التوليف الأدبي وتحليل الميتا',
    titleEn: 'Literature synthesis and meta-analysis',
    descAr: 'جمع الدراسات، أحجام الأثر، PRISMA ومخططات Forest، مع تصفية موحدة للمصادر.',
    descEn: 'Study intake, effect sizes, PRISMA and forest plots, with unified source filtering.',
  },
  {
    icon: <Award size={22} />,
    titleAr: 'التحكيم العلمي مزدوج التعمية',
    titleEn: 'Double-blind peer review',
    descAr: 'محكمون داخليون وخارجيون، نماذج تقييم معيارية، وحماية هوية الأطراف داخل المؤسسة.',
    descEn: 'Internal and external referees, standard rubrics, and identity protection inside the tenant.',
  },
  {
    icon: <Briefcase size={22} />,
    titleAr: 'محرك الترقيات الأكاديمية',
    titleEn: 'Academic promotion engine',
    descAr: 'تنظيم الشواهد وحساب النقاط وفق اللوائح — والقرار النهائي يبقى بشريًا.',
    descEn: 'Evidence scoring against bylaws — the final promotion decision stays human.',
  },
  {
    icon: <BarChart3 size={22} />,
    titleAr: 'التقارير والظهور الأكاديمي',
    titleEn: 'Reports and academic visibility',
    descAr: 'تقارير PDF وWord، ملف باحث موحّد، وأصول علمية مع معرّفات ORCID وDOI.',
    descEn: 'PDF and Word reports, a unified researcher profile, and scholarly assets with ORCID and DOI.',
  },
  {
    icon: <ShieldCheck size={22} />,
    titleAr: 'ذكاء اصطناعي حوكمي',
    titleEn: 'Governed academic AI',
    descAr: 'مساعدة في التلخيص والصياغة داخل عزل المستأجر. لا قرارات ترقية أو قبول أو رسوب مستقلة.',
    descEn: 'Drafting and summarization inside tenant isolation. No autonomous promotion or editorial verdicts.',
  },
];

export const SOLUTIONS = [
  {
    icon: <GraduationCap size={20} />,
    titleAr: 'الباحث وطلاب الدراسات العليا',
    titleEn: 'Researchers and graduate students',
    descAr: 'صمّم الدراسة، احسب العينة، سجّل البروتوكول، وأدر البيانات والتحليل في مسار واحد بدل أدوات متفرقة.',
    descEn: 'Design the study, size the sample, pre-register, and keep data and analysis in one workspace.',
    ctaAr: 'ابدأ مجانًا',
    ctaEn: 'Start free',
    href: '/login?mode=register',
  },
  {
    icon: <Users size={20} />,
    titleAr: 'المجموعات البحثية والكليات',
    titleEn: 'Research groups and colleges',
    descAr: 'مساحة مشتركة بحدود واضحة للأعضاء، تحكيم داخلي، وتقارير قابلة للتصدير دون خلط بيانات المؤسسات.',
    descEn: 'A shared workspace with member limits, internal review, and exports — without mixing tenant data.',
    ctaAr: 'باقة الفرق',
    ctaEn: 'See team plan',
    href: '/pricing',
  },
  {
    icon: <Scale size={20} />,
    titleAr: 'لجان التحكيم والترقيات',
    titleEn: 'Review and promotion committees',
    descAr: 'ملفات شواهد منظمة، تحكيم مزدوج التعمية، وبقاء القرار عند اللجنة لا عند النموذج.',
    descEn: 'Structured evidence files and double-blind review, with the committee retaining the decision.',
    ctaAr: 'اطلب عرضًا',
    ctaEn: 'Request a demo',
    href: '/contact?intent=institutional',
  },
  {
    icon: <Building2 size={20} />,
    titleAr: 'عمادات الدراسات العليا والجامعات',
    titleEn: 'Graduate studies and universities',
    descAr: 'مسارات الرسالة، المناقشة، الممتحنين الخارجيين، والاعتمادات الإدارية داخل عزل مؤسسي.',
    descEn: 'Thesis paths, defense, external examiners, and administrative clearance inside institutional isolation.',
    ctaAr: 'اطلب عرضًا للجامعة',
    ctaEn: 'Book a university demo',
    href: '/contact?intent=demo',
  },
];

export const STEPS = [
  { icon: <GraduationCap size={20} />, step: '01', titleAr: 'أنشئ حسابك ومشروعك', titleEn: 'Create your account and project', descAr: 'سجّل مجانًا، اختر مسارك البحثي، وصمّم المنهجية مع حاسبات العينة والقوة.', descEn: 'Sign up free, pick a research path, and design the method with sample-size tools.' },
  { icon: <GitBranch size={20} />, step: '02', titleAr: 'حلّل وادمج الأدبيات', titleEn: 'Analyze and synthesize', descAr: 'أدخل البيانات، نفّذ التحليل، وابنِ مراجعة الأدبيات ومخططات PRISMA داخل المشروع.', descEn: 'Bring in data, run analysis, and build the literature review and PRISMA inside the project.' },
  { icon: <FileCheck2 size={20} />, step: '03', titleAr: 'راجع وانشر', titleEn: 'Review and publish', descAr: 'أرسل للتحكيم مزدوج التعمية وجهّز حزمة التقديم والتقارير المصدقة.', descEn: 'Submit for double-blind review and prepare the submission pack and certified reports.' },
  { icon: <Crown size={20} />, step: '04', titleAr: 'ترقَّ واظهر', titleEn: 'Advance and get visible', descAr: 'جهّز ملف الترقية، اربط ORCID، وحافظ على هوية أكاديمية موحّدة.', descEn: 'Prepare the promotion dossier, link ORCID, and keep one academic identity.' },
];

export type PlanCode = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'INSTITUTIONAL';

export const PLANS: Array<{
  code: PlanCode;
  nameAr: string;
  nameEn: string;
  audienceAr: string;
  audienceEn: string;
  monthly: number;
  yearly: number;
  highlight: boolean;
  featuresAr: string[];
  featuresEn: string[];
}> = [
  {
    code: 'FREE',
    nameAr: 'مجاني',
    nameEn: 'Free',
    audienceAr: 'التجربة والباحث المستقل',
    audienceEn: 'Trial and independent researchers',
    monthly: 0,
    yearly: 0,
    highlight: false,
    featuresAr: ['3 مشاريع بحثية', 'عضوان', '100 ميجابايت تخزين', '5 تقارير شهريًا', 'تصدير PDF', 'بدون مساعد ذكاء اصطناعي'],
    featuresEn: ['3 research projects', '2 members', '100 MB storage', '5 reports / month', 'PDF export', 'No AI assistant'],
  },
  {
    code: 'STARTER',
    nameAr: 'الباحث',
    nameEn: 'Starter',
    audienceAr: 'الباحث وطلاب الدراسات العليا',
    audienceEn: 'Researchers and graduate students',
    monthly: 99,
    yearly: 990,
    highlight: false,
    featuresAr: ['15 مشروعًا', '10 أعضاء', '2 جيجابايت', '50 تقريرًا شهريًا', 'PDF + Word', 'مساعد ذكاء اصطناعي'],
    featuresEn: ['15 projects', '10 members', '2 GB storage', '50 reports / month', 'PDF + Word', 'AI assistant'],
  },
  {
    code: 'PROFESSIONAL',
    nameAr: 'الفرق',
    nameEn: 'Professional',
    audienceAr: 'المجموعات البحثية والكليات',
    audienceEn: 'Research groups and colleges',
    monthly: 299,
    yearly: 2990,
    highlight: true,
    featuresAr: ['100 مشروع', '50 عضوًا', '20 جيجابايت', 'التحكيم الكامل', 'محرك الترقيات', 'محكمون خارجيون', 'ذكاء اصطناعي متقدم'],
    featuresEn: ['100 projects', '50 members', '20 GB', 'Full peer review', 'Promotion engine', 'External referees', 'Advanced AI'],
  },
  {
    code: 'INSTITUTIONAL',
    nameAr: 'المؤسسات',
    nameEn: 'Institutional',
    audienceAr: 'الجامعات وعمادات الدراسات العليا',
    audienceEn: 'Universities and graduate studies',
    monthly: 999,
    yearly: 9990,
    highlight: false,
    featuresAr: ['مشاريع وأعضاء غير محدودين', 'تخزين غير محدود', 'ترخيص مؤسسي', 'دعم مخصص', 'عزل سيادي كامل'],
    featuresEn: ['Unlimited projects and members', 'Unlimited storage', 'Institutional license', 'Dedicated support', 'Full tenant isolation'],
  },
];

export const FAQ = [
  {
    qAr: 'هل المنصة مناسبة للباحثين المستقلين؟',
    qEn: 'Is the platform suitable for independent researchers?',
    aAr: 'نعم. الباقة المجانية تشمل أدوات تصميم الدراسة الأساسية بثلاثة مشاريع وعضوين. عندما تحتاج تصدير Word أو المساعد الذكي تنتقل إلى باقة الباحث.',
    aEn: 'Yes. Free includes core study-design tools for three projects and two members. Word export and the AI assistant sit on Starter.',
  },
  {
    qAr: 'هل يمكن للجامعات استخدامها؟',
    qEn: 'Can universities use it?',
    aAr: 'نعم. باقة المؤسسات موجّهة لعمادات الدراسات العليا والكليات: رسائل، ممتحنون خارجيون، تحكيم، وترقيات داخل عزل بيانات المؤسسة.',
    aEn: 'Yes. Institutional is for graduate studies and colleges: theses, external examiners, review, and promotions inside tenant isolation.',
  },
  {
    qAr: 'كيف تُحفظ خصوصية التحكيم؟',
    qEn: 'How is peer-review privacy preserved?',
    aAr: 'التحكيم مزدوج التعمية داخل المستأجر: هوية المحكم والتعليقات السرية للمحرر لا تظهر للمؤلف، ولا تُخلط بيانات مؤسسة بأخرى.',
    aEn: 'Review is double-blind inside the tenant: reviewer identity and confidential editor notes never reach the author, and tenants stay isolated.',
  },
  {
    qAr: 'هل يتخذ الذكاء الاصطناعي قرار الترقية أو القبول؟',
    qEn: 'Does the AI decide promotions or acceptances?',
    aAr: 'لا. الذكاء الاصطناعي يساعد في التلخيص والصياغة وتنظيم الشواهد فقط. القرار النهائي يبقى بيد المشرف أو اللجنة أو المحرر.',
    aEn: 'No. AI only helps with summaries, drafting, and evidence organization. Final decisions stay with the supervisor, committee, or editor.',
  },
  {
    qAr: 'هل يمكن الدفع بالبطاقة من الموقع الآن؟',
    qEn: 'Can I pay by card on the website today?',
    aAr: 'نعم للتجربة المجانية فورًا. الباقات المدفوعة تُطلب من الفوترة داخل الحساب بعد إنشاء المؤسسة. الدفع بالبطاقة من الموقع يُفعَّل عند الإطلاق التجاري العام.',
    aEn: 'Yes — start free immediately. Paid plans are requested from billing inside the account after the organization is created. Card checkout on the site will open at public commercial launch.',
  },
  {
    qAr: 'ما الفرق بين بصيرة ومساعد كتابة عام؟',
    qEn: 'How is Baseerah different from a generic writing assistant?',
    aAr: 'بصيرة منصة تشغيل لدورة البحث: تصميم، بيانات، تحكيم، ترقية، ورسالة جامعية — وليست مولّد أوراق. الحوكمة والعزل والصلاحيات جزء من المنتج.',
    aEn: 'Baseerah is research-operations software: design, data, review, promotion, and thesis workflows — not a paper generator. Governance and isolation are product features.',
  },
];

export function formatSar(amount: number, isAr: boolean): string {
  if (amount === 0) return isAr ? '0 ر.س' : '0 SAR';
  return isAr ? `${amount.toLocaleString('en-US')} ر.س` : `${amount.toLocaleString('en-US')} SAR`;
}

export function planHref(code: PlanCode): string {
  if (code === 'INSTITUTIONAL') return '/contact?intent=demo';
  if (code === 'FREE') return '/login?mode=register';
  return `/login?mode=register&plan=${code}`;
}

export function planCta(code: PlanCode, isAr: boolean): string {
  if (code === 'INSTITUTIONAL') return isAr ? 'اطلب عرضًا مؤسسيًا' : 'Request a demo';
  if (code === 'FREE') return isAr ? 'ابدأ مجانًا' : 'Start free';
  return isAr ? 'ابدأ ثم اطلب الترقية' : 'Start, then request upgrade';
}
