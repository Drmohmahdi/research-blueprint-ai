import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Brain, FlaskConical, BookOpen, Award, Briefcase, FileCheck2,
  ShieldCheck, Sparkles, Check, ChevronDown,
  Mail, Phone, ArrowLeft, ArrowRight, GraduationCap,
  BarChart3, GitBranch, Crown, Globe, Users, Building2, Scale
} from 'lucide-react';
import { Button } from '../design-system/components/Button';
import { Input, Textarea } from '../design-system/components/FormControls';
import { useProject } from '../context/ProjectContext';
import { apiCaptureLead } from '../utils/api';
import { FUNNEL_EVENTS, track } from '../utils/analytics';
import { rememberIntendedPlan } from './funnel';

const CONTACT_EMAIL = 'info@ehaastore.com';
const CONTACT_PHONE = '0566007625';

const NAV = [
  { to: '/features', ar: 'المميزات', en: 'Features' },
  { to: '/solutions', ar: 'الحلول', en: 'Solutions' },
  { to: '/how-it-works', ar: 'كيف تعمل', en: 'How it works' },
  { to: '/pricing', ar: 'الباقات', en: 'Pricing' },
  { to: '/faq', ar: 'الأسئلة', en: 'FAQ' },
  { to: '/about', ar: 'عن المنصة', en: 'About' },
  { to: '/contact', ar: 'تواصل', en: 'Contact' },
] as const;

const PAGE_SEO: Record<string, { titleAr: string; titleEn: string; descAr: string; descEn: string }> = {
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

const FEATURES = [
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

const SOLUTIONS = [
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
    ctaAr: 'عرض مؤسسي',
    ctaEn: 'Institutional demo',
    href: '/contact?intent=demo',
  },
];

const STEPS = [
  { icon: <GraduationCap size={20} />, step: '01', titleAr: 'أنشئ حسابك ومشروعك', titleEn: 'Create your account and project', descAr: 'سجّل مجانًا، اختر مسارك البحثي، وصمّم المنهجية مع حاسبات العينة والقوة.', descEn: 'Sign up free, pick a research path, and design the method with sample-size tools.' },
  { icon: <GitBranch size={20} />, step: '02', titleAr: 'حلّل وادمج الأدبيات', titleEn: 'Analyze and synthesize', descAr: 'أدخل البيانات، نفّذ التحليل، وابنِ مراجعة الأدبيات ومخططات PRISMA داخل المشروع.', descEn: 'Bring in data, run analysis, and build the literature review and PRISMA inside the project.' },
  { icon: <FileCheck2 size={20} />, step: '03', titleAr: 'راجع وانشر', titleEn: 'Review and publish', descAr: 'أرسل للتحكيم مزدوج التعمية وجهّز حزمة التقديم والتقارير المصدقة.', descEn: 'Submit for double-blind review and prepare the submission pack and certified reports.' },
  { icon: <Crown size={20} />, step: '04', titleAr: 'ترقَّ واظهر', titleEn: 'Advance and get visible', descAr: 'جهّز ملف الترقية، اربط ORCID، وحافظ على هوية أكاديمية موحّدة.', descEn: 'Prepare the promotion dossier, link ORCID, and keep one academic identity.' },
];

type PlanCode = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'INSTITUTIONAL';

const PLANS: Array<{
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

const FAQ = [
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
    aAr: 'تبدأ مجانًا فورًا. الباقات المدفوعة تُطلب من داخل الحساب بعد إنشاء المؤسسة. ربط بوابة الدفع الحيّة يتم تشغيليًا قبل الإطلاق التجاري العام.',
    aEn: 'You can start free immediately. Paid plans are requested from inside the account after the organization is created. Live card checkout is an operational go-live step.',
  },
  {
    qAr: 'ما الفرق بين بصيرة ومساعد كتابة عام؟',
    qEn: 'How is Baseerah different from a generic writing assistant?',
    aAr: 'بصيرة منصة تشغيل لدورة البحث: تصميم، بيانات، تحكيم، ترقية، ورسالة جامعية — وليست مولّد أوراق. الحوكمة والعزل والصلاحيات جزء من المنتج.',
    aEn: 'Baseerah is research-operations software: design, data, review, promotion, and thesis workflows — not a paper generator. Governance and isolation are product features.',
  },
];

function formatSar(amount: number, isAr: boolean): string {
  if (amount === 0) return isAr ? '0 ر.س' : '0 SAR';
  return isAr ? `${amount.toLocaleString('en-US')} ر.س` : `${amount.toLocaleString('en-US')} SAR`;
}

function planHref(code: PlanCode): string {
  if (code === 'INSTITUTIONAL') return '/contact?intent=demo';
  if (code === 'FREE') return '/login?mode=register';
  return `/login?mode=register&plan=${code}`;
}

function planCta(code: PlanCode, isAr: boolean): string {
  if (code === 'INSTITUTIONAL') return isAr ? 'اطلب عرضًا مؤسسيًا' : 'Request a demo';
  if (code === 'FREE') return isAr ? 'ابدأ مجانًا' : 'Start free';
  return isAr ? 'سجّل واطلب الترقية' : 'Sign up, then upgrade';
}

const LeadForm: React.FC<{ isAr: boolean; defaultIntent?: string; compact?: boolean }> = ({
  isAr,
  defaultIntent = 'demo',
  compact = false,
}) => {
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [intent, setIntent] = useState(defaultIntent);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (defaultIntent) setIntent(defaultIntent);
  }, [defaultIntent]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('loading');
    setError('');
    const result = await apiCaptureLead({
      name,
      email,
      organization,
      intent,
      message,
      source_path: location.pathname,
    });
    if (result?.ok) {
      setStatus('ok');
      track(FUNNEL_EVENTS.generateLead, { intent, source_path: location.pathname });
      setName('');
      setEmail('');
      setOrganization('');
      setMessage('');
      return;
    }
    setStatus('error');
    setError(
      isAr
        ? 'تعذر الإرسال. راسلنا مباشرة على البريد أدناه أو أعد المحاولة.'
        : 'Could not send. Email us directly below, or try again.',
    );
  };

  if (status === 'ok') {
    return (
      <div className="rounded-2xl border border-[var(--ds-border-subtle)] bg-[var(--ds-primary-soft)] p-5 text-sm font-semibold text-[var(--ds-text-primary)]">
        {isAr
          ? 'وصل طلبك. سنتواصل معك عبر البريد. يمكنك إنشاء حساب مجاني الآن إن رغبت في التجربة فورًا.'
          : 'Request received. We will follow up by email. You can also create a free account now.'}
        <div className="mt-3">
          <Link to="/login?mode=register" className="text-[var(--ds-primary-bright)] font-black">
            {isAr ? 'إنشاء حساب مجاني' : 'Create a free account'}
          </Link>
          <span className="text-[var(--ds-text-muted)]"> · </span>
          <Link to="/institutional" className="text-[var(--ds-primary-bright)] font-black">
            {isAr ? 'موجز العرض للجامعة' : 'University brief'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-start">
      <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2'}`}>
        <Input
          label={isAr ? 'الاسم' : 'Name'}
          requiredIndicator
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        <Input
          label={isAr ? 'البريد' : 'Email'}
          type="email"
          requiredIndicator
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          dir="ltr"
        />
      </div>
      <Input
        label={isAr ? 'الجهة (اختياري)' : 'Organization (optional)'}
        value={organization}
        onChange={(e) => setOrganization(e.target.value)}
      />
      <label className="flex flex-col gap-1.5 text-xs font-bold text-[var(--ds-text-secondary)]">
        {isAr ? 'الغرض' : 'Intent'}
        <select
          className="w-full bg-[var(--ds-surface-primary)] border border-[var(--ds-border-default)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--ds-text-primary)]"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
        >
          <option value="demo">{isAr ? 'طلب عرض / تجربة مؤسسية' : 'Demo / institutional trial'}</option>
          <option value="institutional">{isAr ? 'باقة الجامعات' : 'University plan'}</option>
          <option value="trial">{isAr ? 'البدء كباحث' : 'Start as a researcher'}</option>
          <option value="support">{isAr ? 'دعم أو استفسار' : 'Support'}</option>
        </select>
      </label>
      <Textarea
        label={isAr ? 'الرسالة' : 'Message'}
        rows={compact ? 3 : 5}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {error && <p role="alert" className="text-[11px] font-semibold text-[var(--ds-danger)] m-0">{error}</p>}
      <Button type="submit" loading={status === 'loading'} fullWidth>
        {isAr ? 'إرسال الطلب' : 'Send request'}
      </Button>
      <p className="text-[10px] text-[var(--ds-text-muted)] font-medium m-0">
        {isAr
          ? 'لن نبيع بياناتك. نستخدمها للرد على طلبك وتجهيز العرض المناسب لجهتك.'
          : 'We will not sell your data. It is used to reply and prepare the right conversation for your institution.'}
      </p>
    </form>
  );
};

export const MarketingSite: React.FC = () => {
  const { language, setLanguage, user } = useProject();
  const isAr = language === 'ar';
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('yearly');
  const page = location.pathname === '/home' ? '/' : location.pathname;
  const defaultIntent = searchParams.get('intent') || (page === '/contact' ? 'demo' : 'demo');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    track(FUNNEL_EVENTS.pageView, { path: page });
    if (page === '/pricing') track(FUNNEL_EVENTS.viewPricing, { path: page });
  }, [page]);

  useEffect(() => {
    const seo = PAGE_SEO[page] || PAGE_SEO['/'];
    document.title = isAr ? seo.titleAr : seo.titleEn;
    document.documentElement.lang = isAr ? 'ar' : 'en';
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', isAr ? seo.descAr : seo.descEn);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', isAr ? seo.titleAr : seo.titleEn);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', isAr ? seo.descAr : seo.descEn);
  }, [page, isAr]);

  const goRegister = (plan?: PlanCode) => {
    if (plan) rememberIntendedPlan(plan);
    track(FUNNEL_EVENTS.ctaSignup, { plan: plan || 'FREE', path: page });
    navigate(plan ? planHref(plan) : '/login?mode=register');
  };

  const showHome = page === '/';
  const showFeatures = showHome || page === '/features';
  const showSolutions = showHome || page === '/solutions';
  const showHow = showHome || page === '/how-it-works';
  const showPricing = showHome || page === '/pricing';
  const showFaq = showHome || page === '/faq';
  const showAbout = page === '/about';
  const showInstitutional = page === '/institutional';
  const showContact = showHome || page === '/contact';

  const pageHeading = useMemo(() => {
    if (page === '/features') return isAr ? 'ما الذي تفعله المنصة فعلًا' : 'What the product actually does';
    if (page === '/solutions') return isAr ? 'اختر مسارك حسب دورك' : 'Choose the path that matches your role';
    if (page === '/how-it-works') return isAr ? 'من الحساب إلى التقرير المعتمد' : 'From account to certified report';
    if (page === '/pricing') return isAr ? 'أسعار مبنية على حجم العمل البحثي' : 'Pricing built around research workload';
    if (page === '/faq') return isAr ? 'أسئلة تتكرر قبل الاشتراك' : 'Questions before you subscribe';
    if (page === '/about') return isAr ? 'منصة تشغيل أكاديمي لا مولّد أوراق' : 'Academic operations, not a paper mill';
    if (page === '/contact') return isAr ? 'اطلب عرضًا أو ابدأ كباحث' : 'Request a demo or start as a researcher';
    if (page === '/institutional') return isAr ? 'موجز تشغيلي للكلية والعمادة' : 'Operational brief for colleges and graduate offices';
    return '';
  }, [page, isAr]);

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="baseerah-marketing min-h-screen font-sans">
      <header className={`fixed top-0 inset-x-0 z-50 ds-transition print:hidden ${scrolled ? 'baseerah-glass border-b border-[var(--ds-border-subtle)] py-2' : 'py-4'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 no-underline text-inherit">
            <div className="p-2 rounded-xl bg-action text-on-action shadow-[var(--ds-shadow-glow)]">
              <Brain size={20} />
            </div>
            <div>
              <span className="text-sm font-black tracking-wide baseerah-gradient-text">{isAr ? 'بصيرة' : 'BASEERAH'}</span>
              <span className="text-[9px] font-bold text-[var(--ds-text-muted)] block">{isAr ? 'الجودة الأكاديمية السعودية' : 'Saudi Academic Premium'}</span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-5 text-xs font-bold text-[var(--ds-text-muted)]">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `hover:text-[var(--ds-primary-bright)] ds-transition no-underline ${isActive ? 'text-[var(--ds-primary-bright)]' : 'text-[var(--ds-text-muted)]'}`
                }
              >
                {isAr ? item.ar : item.en}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguage(isAr ? 'en' : 'ar')}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[var(--ds-border-default)] text-[10px] font-bold text-[var(--ds-text-secondary)] cursor-pointer bg-transparent"
            >
              <Globe size={12} />
              {isAr ? 'EN' : 'عربي'}
            </button>
            {user ? (
              <Button onClick={() => navigate('/app')} className="px-4 py-2 rounded-xl text-xs font-black">
                {isAr ? 'لوحة التحكم' : 'Open workspace'}
              </Button>
            ) : (
              <>
                <Button onClick={() => navigate('/login')} variant="outline" className="px-4 py-2 rounded-xl text-xs font-black">
                  {isAr ? 'دخول' : 'Sign in'}
                </Button>
                <Button onClick={() => goRegister()} className="px-4 py-2 rounded-xl text-xs font-black">
                  {isAr ? 'ابدأ مجانًا' : 'Start free'}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {showHome && (
        <section className="relative pt-36 pb-20 px-4 sm:px-6 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-[25%] right-[10%] w-[60vw] h-[60vw] rounded-full bg-[var(--ds-aurora-emerald)] blur-[120px]" />
            <div className="absolute top-[30%] -left-[15%] w-[40vw] h-[40vw] rounded-full bg-[var(--ds-aurora-gold)] blur-[120px]" />
          </div>
          <div className="relative max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--ds-accent-gold)]/25 bg-[var(--ds-accent-gold-soft)] text-[var(--ds-accent-gold)] text-[10px] font-black mb-6">
              <Sparkles size={12} />
              <span>{isAr ? 'منصة سعودية لدورة البحث العلمي — ليست مولّد أوراق' : 'Saudi research-operations platform — not a paper generator'}</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black leading-tight tracking-tight m-0">
              {isAr ? (
                <>
                  <span className="baseerah-gradient-text">من التصميم إلى الاعتماد</span>
                  <br />
                  في مساحة بحثية واحدة
                </>
              ) : (
                <>
                  From study design to
                  <br />
                  <span className="baseerah-gradient-text">institutional clearance</span>
                </>
              )}
            </h1>
            <p className="max-w-2xl mx-auto mt-6 text-sm sm:text-base text-[var(--ds-text-secondary)] leading-relaxed font-medium">
              {isAr
                ? 'بصيرة تجمع تصميم الدراسة، الإحصاء، الأدبيات، التحكيم مزدوج التعمية، الترقيات، والرسائل الجامعية. القرار يبقى بشريًا، والبيانات معزولة لكل مؤسسة، والواجهة عربية وإنجليزية.'
                : 'Baseerah unifies study design, statistics, literature, double-blind review, promotions, and thesis operations. Humans decide, each institution stays isolated, and Arabic and English are first-class.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Button onClick={() => goRegister()} className="px-7 py-3 rounded-2xl text-sm font-black" iconAfter={isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}>
                {isAr ? 'أنشئ حسابًا مجانيًا' : 'Create a free account'}
              </Button>
              <Button onClick={() => navigate('/pricing')} variant="outline" className="px-7 py-3 rounded-2xl text-sm font-black">
                {isAr ? 'شاهد الباقات' : 'See pricing'}
              </Button>
              <Button onClick={() => navigate('/contact?intent=demo')} variant="ghost" className="px-7 py-3 rounded-2xl text-sm font-black">
                {isAr ? 'طلب عرض للجامعة' : 'University demo'}
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto">
              {[
                { value: isAr ? 'دورة كاملة' : 'Full cycle', labelAr: 'تصميم → تحليل → تحكيم → ترقية', labelEn: 'Design → analysis → review → promotion' },
                { value: 'AR+EN', labelAr: 'عربي وإنجليزي أصلًا', labelEn: 'Arabic and English native' },
                { value: isAr ? 'بشري أولًا' : 'Human-first', labelAr: 'لا قرار ترقية أو قبول آلي', labelEn: 'No automated verdicts' },
                { value: isAr ? 'عزل مؤسسي' : 'Isolated', labelAr: 'بيانات كل جهة منفصلة', labelEn: 'Per-institution tenancy' },
              ].map((item) => (
                <div key={item.value} className="rounded-2xl border border-[var(--ds-border-subtle)] bg-white/[0.03] p-4">
                  <div className="text-sm font-black text-[var(--ds-accent-gold)]">{item.value}</div>
                  <div className="text-[10px] font-bold text-[var(--ds-text-muted)] mt-1">{isAr ? item.labelAr : item.labelEn}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {!showHome && (
        <section className="relative pt-32 pb-10 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ds-accent-gold)] m-0">
              {page === '/institutional'
                ? (isAr ? 'للجامعات' : 'Universities')
                : NAV.find((item) => item.to === page)
                  ? (isAr ? NAV.find((item) => item.to === page)?.ar : NAV.find((item) => item.to === page)?.en)
                  : ''}
            </p>
            <h1 className="text-3xl sm:text-4xl font-black mt-2 m-0">{pageHeading}</h1>
          </div>
        </section>
      )}

      {showAbout && (
        <section className="py-8 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto space-y-4 text-sm leading-relaxed text-[var(--ds-text-secondary)] font-medium">
            <p>
              {isAr
                ? 'بصيرة (Research Blueprint AI) منصة سحابية للجامعات والباحثين في السياق السعودي والعربي: تشغّل دورة البحث بدل أن تكتب الورقة نيابة عن المؤلف. المنتج مزدوج الطبقة — واجهة بحثية وخلفية تشغيلية — مع مؤسسات متعددة المستأجرين وصلاحيات وحدود استخدام.'
                : 'Baseerah (Research Blueprint AI) is cloud software for universities and researchers in the Saudi and Arabic academic context: it runs the research lifecycle instead of writing the paper for the author. It is a two-tier product — research UI and operational API — with multi-tenant organizations, roles, and usage limits.'}
            </p>
            <p>
              {isAr
                ? 'القيمة ليست «ذكاء اصطناعي يطلق قرارات». القيمة أن المشرف واللجنة وعمادة الدراسات العليا يبقون أصحاب القرار، بينما تبقى الملفات والمنهجية والتحكيم والترقية في نظام واحد يمكن حوكمته.'
                : 'The value is not AI that issues verdicts. The value is that supervisors, committees, and graduate studies remain decision-makers, while method, review, and promotion live in one governable system.'}
            </p>
          </div>
        </section>
      )}

      {showInstitutional && (
        <section className="py-6 px-4 sm:px-6 pb-20">
          <article className="max-w-3xl mx-auto space-y-8 text-sm leading-relaxed text-[var(--ds-text-secondary)] font-medium">
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button type="button" size="sm" onClick={() => window.print()}>
                {isAr ? 'طباعة أو حفظ PDF' : 'Print or save PDF'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => navigate('/contact?intent=institutional')}>
                {isAr ? 'اطلب عرضًا' : 'Request a demo'}
              </Button>
            </div>
            <p>
              {isAr
                ? 'بصيرة منصة تشغيل أكاديمي للكليات وعمادات الدراسات العليا ولجان الترقيات. ليست مولّد أوراق، ولا تُفعَّل الباقة المؤسسية ببطاقة من الموقع.'
                : 'Baseerah is an academic operations platform for colleges, graduate studies offices, and promotion committees. It is not a paper generator, and the institutional plan is not activated by card checkout on the site.'}
            </p>
            <div className="space-y-2">
              <h2 className="text-lg font-black text-[var(--ds-text-primary)] m-0">{isAr ? 'لمن هذا العرض' : 'Who this is for'}</h2>
              <ul className="m-0 ps-5 space-y-1">
                <li>{isAr ? 'عمادة الدراسات العليا: مسارات الرسالة، المناقشة، والممتحنون الخارجيون داخل عزل مؤسسي.' : 'Graduate studies: thesis paths, defense, and external examiners inside tenant isolation.'}</li>
                <li>{isAr ? 'الكليات والمجموعات البحثية: مساحة مشتركة بحدود أعضاء ومشاريع دون خلط بيانات الجهات.' : 'Colleges and research groups: a shared workspace with member and project limits, without mixing tenant data.'}</li>
                <li>{isAr ? 'لجان التحكيم والترقيات: شواهد منظمة وتحكيم مزدوج التعمية، والقرار يبقى بشريًا.' : 'Review and promotion committees: structured evidence and double-blind review, with human decisions.'}</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-black text-[var(--ds-text-primary)] m-0">{isAr ? 'ما الذي يُجرَّب بمعزل حقيقي' : 'What a real isolated trial includes'}</h2>
              <p>
                {isAr
                  ? 'بعد طلب العرض نفتح مؤسسة مستقلة ببياناتها الخاصة: حسابات أدوار (مالك، مشرف، باحث، مشاهد)، مشروع رسالة أو دراسة واحد، ومسار تحكيم أو ترقية حسب حاجة الجهة. لا تُخلط بيانات التجربة مع أي مستأجر آخر.'
                  : 'After the demo request we open a separate organization with its own data: role accounts (owner, supervisor, researcher, viewer), one thesis or study project, and a review or promotion path as needed. Trial data is never mixed with another tenant.'}
              </p>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-black text-[var(--ds-text-primary)] m-0">{isAr ? 'التسعير المؤسسي' : 'Institutional pricing'}</h2>
              <p>
                {isAr
                  ? 'باقة المؤسسات: 999 ر.س شهريًا أو 9990 ر.س سنويًا (شهرين مجانًا على السنوي). الاشتراك عبر طلب عرض ومتابعة يدوية — ليس دفعًا ذاتيًا بالبطاقة اليوم.'
                  : 'Institutional plan: 999 SAR monthly or 9,990 SAR yearly (two months free on annual). Subscription is a sales-assisted demo — not self-serve card checkout today.'}
              </p>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-black text-[var(--ds-text-primary)] m-0">{isAr ? 'الخطوة التالية' : 'Next step'}</h2>
              <p>
                {isAr
                  ? 'أرسل طلبًا من صفحة التواصل، أو راسل info@ehaastore.com. نرد بمسار تجريبي معزول ثم عرض للكلية أو العمادة.'
                  : 'Send a request from the contact page, or email info@ehaastore.com. We reply with an isolated trial path, then a college or graduate-office conversation.'}
              </p>
            </div>
          </article>
        </section>
      )}

      {showSolutions && (
        <section id="solutions" className="py-16 px-4 sm:px-6 border-t border-[var(--ds-border-subtle)]">
          <div className="max-w-7xl mx-auto">
            {showHome && (
              <div className="text-center mb-12">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--ds-accent-gold)]">{isAr ? 'لمن؟' : 'Who it is for'}</span>
                <h2 className="text-2xl sm:text-4xl font-black mt-2 m-0">{isAr ? 'حل واحد، مسارات حسب الدور' : 'One platform, role-based paths'}</h2>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {SOLUTIONS.map((item) => (
                <div key={item.href + item.titleEn} className="rounded-3xl border border-[var(--ds-border-subtle)] bg-white/[0.03] p-6 flex flex-col">
                  <div className="h-10 w-10 rounded-xl bg-[var(--ds-primary-soft)] text-[var(--ds-primary-bright)] flex items-center justify-center mb-4">{item.icon}</div>
                  <h3 className="text-sm font-black m-0">{isAr ? item.titleAr : item.titleEn}</h3>
                  <p className="text-xs text-[var(--ds-text-muted)] leading-relaxed font-medium mt-2 flex-1">{isAr ? item.descAr : item.descEn}</p>
                  <Link to={item.href} className="mt-4 text-xs font-black text-[var(--ds-primary-bright)] no-underline">
                    {isAr ? item.ctaAr : item.ctaEn} →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {showFeatures && (
        <section id="features" className="py-16 px-4 sm:px-6 border-t border-[var(--ds-border-subtle)]">
          <div className="max-w-7xl mx-auto">
            {showHome && (
              <div className="text-center mb-12">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--ds-accent-gold)]">{isAr ? 'المميزات' : 'Features'}</span>
                <h2 className="text-2xl sm:text-4xl font-black mt-2 m-0">{isAr ? 'ماذا يُحل داخل المنصة' : 'What gets solved in-product'}</h2>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((feature) => (
                <div key={feature.titleEn} className="rounded-3xl border border-[var(--ds-border-subtle)] bg-white/[0.03] p-6">
                  <div className="h-11 w-11 rounded-2xl bg-[var(--ds-primary-soft)] text-[var(--ds-primary-bright)] flex items-center justify-center mb-4">{feature.icon}</div>
                  <h3 className="text-sm font-black m-0">{isAr ? feature.titleAr : feature.titleEn}</h3>
                  <p className="text-xs text-[var(--ds-text-muted)] leading-relaxed font-medium mt-2">{isAr ? feature.descAr : feature.descEn}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {showHow && (
        <section id="how" className="py-16 px-4 sm:px-6 border-t border-[var(--ds-border-subtle)] bg-white/[0.015]">
          <div className="max-w-6xl mx-auto">
            {showHome && (
              <div className="text-center mb-12">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--ds-accent-gold)]">{isAr ? 'كيف تعمل' : 'How it works'}</span>
                <h2 className="text-2xl sm:text-4xl font-black mt-2 m-0">{isAr ? 'أربع خطوات بعد التسجيل' : 'Four steps after signup'}</h2>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {STEPS.map((step) => (
                <div key={step.step} className="relative rounded-3xl border border-[var(--ds-border-subtle)] bg-white/[0.03] p-6">
                  <div className="absolute top-4 end-4 text-3xl font-black text-white/5">{step.step}</div>
                  <div className="h-10 w-10 rounded-xl bg-[var(--ds-accent-gold-soft)] text-[var(--ds-accent-gold)] flex items-center justify-center mb-4">{step.icon}</div>
                  <h3 className="text-sm font-black m-0">{isAr ? step.titleAr : step.titleEn}</h3>
                  <p className="text-xs text-[var(--ds-text-muted)] font-medium leading-relaxed mt-2">{isAr ? step.descAr : step.descEn}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {showPricing && (
        <section id="pricing" className="py-16 px-4 sm:px-6 border-t border-[var(--ds-border-subtle)]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-10">
              {showHome && (
                <>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--ds-accent-gold)]">{isAr ? 'الباقات' : 'Pricing'}</span>
                  <h2 className="text-2xl sm:text-4xl font-black mt-2 m-0">{isAr ? 'ابدأ مجانًا. ادفع عندما يكبر الفريق.' : 'Start free. Pay when the team grows.'}</h2>
                </>
              )}
              <p className="text-xs text-[var(--ds-text-muted)] font-semibold mt-3 max-w-xl mx-auto">
                {isAr
                  ? 'الأسعار بالريال السعودي. الاشتراك السنوي يوفّر شهرين. الباقات المدفوعة تُفعَّل من داخل الحساب؛ ابدأ مجانًا اليوم.'
                  : 'Prices in SAR. Annual billing saves two months. Paid plans activate from inside the account; start free today.'}
              </p>
              <div className="inline-flex mt-5 rounded-full border border-[var(--ds-border-subtle)] p-1">
                <button
                  type="button"
                  className={`px-4 py-1.5 rounded-full text-[11px] font-black cursor-pointer ${billingInterval === 'monthly' ? 'bg-action text-on-action' : 'bg-transparent text-[var(--ds-text-muted)]'}`}
                  onClick={() => setBillingInterval('monthly')}
                >
                  {isAr ? 'شهري' : 'Monthly'}
                </button>
                <button
                  type="button"
                  className={`px-4 py-1.5 rounded-full text-[11px] font-black cursor-pointer ${billingInterval === 'yearly' ? 'bg-action text-on-action' : 'bg-transparent text-[var(--ds-text-muted)]'}`}
                  onClick={() => setBillingInterval('yearly')}
                >
                  {isAr ? 'سنوي — شهران مجانًا' : 'Annual — 2 months free'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {PLANS.map((plan) => {
                const price = billingInterval === 'yearly' ? plan.yearly : plan.monthly;
                const period = billingInterval === 'yearly'
                  ? (isAr ? 'سنويًا' : '/ year')
                  : (isAr ? 'شهريًا' : '/ month');
                return (
                  <div
                    key={plan.code}
                    className={`relative rounded-3xl border p-6 flex flex-col ${
                      plan.highlight
                        ? 'border-[var(--ds-accent-gold)]/40 bg-gradient-to-b from-[var(--ds-accent-gold-soft)] to-transparent'
                        : 'border-[var(--ds-border-subtle)] bg-white/[0.03]'
                    }`}
                  >
                    {plan.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--ds-accent-gold)] text-[var(--ds-navy)] text-[9px] font-black">
                        {isAr ? 'الأكثر ملاءمة للفرق' : 'Best for teams'}
                      </div>
                    )}
                    <h3 className="text-sm font-black m-0">{isAr ? plan.nameAr : plan.nameEn}</h3>
                    <p className="text-[10px] font-bold text-[var(--ds-text-muted)] mt-1 m-0">{isAr ? plan.audienceAr : plan.audienceEn}</p>
                    <div className="flex items-baseline gap-1.5 mt-3">
                      <span className="text-3xl font-black text-white">{formatSar(price, isAr)}</span>
                      <span className="text-[10px] font-bold text-[var(--ds-text-muted)]">{period}</span>
                    </div>
                    {billingInterval === 'yearly' && plan.monthly > 0 && (
                      <p className="text-[10px] text-[var(--ds-text-muted)] mt-1 m-0">
                        {isAr ? `يعادل ${formatSar(plan.monthly, true)} شهريًا عند الدفع السنوي` : `Equals ${formatSar(plan.monthly, false)} / mo billed annually`}
                      </p>
                    )}
                    <ul className="flex-1 space-y-2 mt-5 text-xs font-semibold text-[var(--ds-text-secondary)]">
                      {(isAr ? plan.featuresAr : plan.featuresEn).map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check size={13} className="text-[var(--ds-primary-bright)] shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => goRegister(plan.code)}
                      className={`mt-6 w-full py-2.5 rounded-2xl text-xs font-black ds-transition cursor-pointer ${
                        plan.highlight
                          ? 'bg-action hover:bg-action-hover text-on-action'
                          : 'border border-[var(--ds-border-default)] bg-white/4 hover:bg-white/8 text-[var(--ds-text-primary)]'
                      }`}
                    >
                      {planCta(plan.code, isAr)}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {showFaq && (
        <section id="faq" className="py-16 px-4 sm:px-6 border-t border-[var(--ds-border-subtle)] bg-white/[0.015]">
          <div className="max-w-3xl mx-auto">
            {showHome && (
              <div className="text-center mb-10">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--ds-accent-gold)]">{isAr ? 'الأسئلة الشائعة' : 'FAQ'}</span>
                <h2 className="text-2xl sm:text-3xl font-black mt-2 m-0">{isAr ? 'قبل أن تنشئ الحساب' : 'Before you create an account'}</h2>
              </div>
            )}
            <div className="space-y-3">
              {FAQ.map((item, index) => (
                <div key={item.qEn} className="rounded-2xl border border-[var(--ds-border-subtle)] bg-white/[0.03] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="w-full flex items-center justify-between px-5 py-4 text-xs font-black text-[var(--ds-text-primary)] cursor-pointer bg-transparent border-0"
                    aria-expanded={openFaq === index}
                  >
                    <span>{isAr ? item.qAr : item.qEn}</span>
                    <ChevronDown size={14} className={`text-[var(--ds-accent-gold)] ds-transition ${openFaq === index ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === index && (
                    <div className="px-5 pb-4 text-xs text-[var(--ds-text-muted)] font-medium leading-relaxed">
                      {isAr ? item.aAr : item.aEn}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {showContact && (
        <section id="contact" className="py-16 px-4 sm:px-6 border-t border-[var(--ds-border-subtle)]">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div>
              {showHome && (
                <>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--ds-accent-gold)]">{isAr ? 'الخطوة التالية' : 'Next step'}</span>
                  <h2 className="text-2xl sm:text-3xl font-black mt-2 m-0">{isAr ? 'باحث؟ ابدأ. جامعة؟ اطلب عرضًا.' : 'Researcher? Start. University? Book a demo.'}</h2>
                </>
              )}
              <p className="text-xs text-[var(--ds-text-muted)] font-semibold mt-3 leading-relaxed">
                {isAr
                  ? 'للباحث: أنشئ حسابًا مجانيًا خلال دقائق. للكلية أو العمادة: اترك بياناتك وسنعود إليك بمسار مؤسسي.'
                  : 'Researchers can create a free account in minutes. Colleges and graduate offices can leave details for an institutional conversation.'}
              </p>
              <p className="text-xs font-bold mt-3 m-0">
                <Link to="/institutional" className="text-[var(--ds-primary-bright)] no-underline">
                  {isAr ? 'اقرأ الموجز التشغيلي للجامعة (قابل للطباعة)' : 'Read the printable university brief'}
                </Link>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                <a href={`mailto:${CONTACT_EMAIL}`} className="rounded-3xl border border-[var(--ds-border-subtle)] bg-white/[0.03] p-5 no-underline">
                  <Mail size={18} className="text-[var(--ds-primary-bright)] mb-2" />
                  <div className="text-[10px] font-bold text-[var(--ds-text-muted)]">{isAr ? 'البريد' : 'Email'}</div>
                  <div className="text-sm font-black text-[var(--ds-text-primary)] mt-1 break-all" dir="ltr">{CONTACT_EMAIL}</div>
                </a>
                <a href={`tel:${CONTACT_PHONE}`} className="rounded-3xl border border-[var(--ds-border-subtle)] bg-white/[0.03] p-5 no-underline">
                  <Phone size={18} className="text-[var(--ds-accent-gold)] mb-2" />
                  <div className="text-[10px] font-bold text-[var(--ds-text-muted)]">{isAr ? 'الجوال' : 'Phone'}</div>
                  <div className="text-sm font-black text-[var(--ds-text-primary)] mt-1" dir="ltr">{CONTACT_PHONE}</div>
                </a>
              </div>
            </div>
            <div className="rounded-3xl border border-[var(--ds-border-subtle)] bg-white/[0.03] p-6">
              <h3 className="text-sm font-black m-0 mb-4">{isAr ? 'نموذج طلب تواصل' : 'Contact form'}</h3>
              <LeadForm isAr={isAr} defaultIntent={defaultIntent} compact={showHome} />
            </div>
          </div>
        </section>
      )}

      <footer className="py-10 px-4 sm:px-6 border-t border-[var(--ds-border-subtle)] bg-white/[0.015] print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-2.5 no-underline text-inherit">
            <div className="p-2 rounded-xl bg-action text-on-action"><Brain size={16} /></div>
            <div>
              <span className="text-xs font-black tracking-wide baseerah-gradient-text">{isAr ? 'بصيرة للبحث العلمي' : 'Baseerah Academic Suite'}</span>
              <span className="text-[9px] font-bold text-[var(--ds-text-muted)] block">{isAr ? 'الجودة الأكاديمية السعودية' : 'Saudi Academic Premium'}</span>
            </div>
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] font-bold text-[var(--ds-text-muted)]">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className="hover:text-[var(--ds-primary-bright)] no-underline text-inherit">{isAr ? item.ar : item.en}</Link>
            ))}
            <Link to="/institutional" className="hover:text-[var(--ds-primary-bright)] no-underline text-inherit">{isAr ? 'للجامعات' : 'Universities'}</Link>
            <Link to="/login" className="hover:text-[var(--ds-primary-bright)] no-underline text-inherit">{isAr ? 'دخول' : 'Login'}</Link>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-6 pt-6 border-t border-[var(--ds-border-subtle)] text-center text-[10px] text-[var(--ds-text-muted)] font-semibold">
          © {new Date().getFullYear()} {isAr ? 'بصيرة للبحث العلمي — جميع الحقوق محفوظة.' : 'Baseerah Academic Suite — All rights reserved.'}
        </div>
      </footer>
    </div>
  );
};

export default MarketingSite;
