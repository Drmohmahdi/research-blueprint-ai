import React, { useState, useEffect } from 'react';
import {
  Brain, FlaskConical, BookOpen, Award, Briefcase, FileCheck2,
  ShieldCheck, Sparkles, Check, ChevronDown,
  Mail, Phone, ArrowLeft, ArrowRight, GraduationCap,
  BarChart3, GitBranch, Crown
} from 'lucide-react';

const CONTACT_EMAIL = 'info@ehaastore.com';
const CONTACT_PHONE = '0566007625';
const PLATFORM_VERSION = '3.0';

interface LandingPageProps {
  language: 'ar' | 'en';
  onNavigateToLogin: () => void;
}

const FEATURES: { icon: React.ReactNode; titleAr: string; titleEn: string; descAr: string; descEn: string }[] = [
  {
    icon: <FlaskConical size={22} />,
    titleAr: 'تصميم الدراسات البحثية',
    titleEn: 'Research Study Design',
    descAr: 'منهجيات كاملة لتصميم الدراسات التجريبية والارتباطية والتنبؤية مع حاسبات حجم العينة وتحليل القوة الإحصائية.',
    descEn: 'Full study design methodologies — experimental, correlational, predictive — with sample size and power calculators.',
  },
  {
    icon: <BookOpen size={22} />,
    titleAr: 'التوليف الأدبي وتحليل الميتا',
    titleEn: 'Literature Synthesis & Meta-Analysis',
    descAr: 'جمع الدراسات، حساب حجم الأثر وفترات الثقة، ومخططات PRISMA وForest المتقدمة مع تصفية موحدة.',
    descEn: 'Study collection, effect size & confidence intervals, advanced PRISMA and forest plots, with unified filtering.',
  },
  {
    icon: <Award size={22} />,
    titleAr: 'التحكيم العلمي الموثوق',
    titleEn: 'Trusted Peer Review',
    descAr: 'نظام تحكيم مزدوج التعمية مع محكمين داخليين وخارجيين، ونماذج تقييم معيارية، وحماية كاملة للخصوصية.',
    descEn: 'Double-blind review with internal & external referees, standard rubrics, and full privacy protection.',
  },
  {
    icon: <Briefcase size={22} />,
    titleAr: 'محرك الترقيات الأكاديمية',
    titleEn: 'Academic Promotion Engine',
    descAr: 'تقييم استحقاق الشواهد وفق اللوائح المعتمدة، وحساب النقاط، وإعداد ملف الترقية — مع بقاء القرار النهائي بشريًا.',
    descEn: 'Evidence-based readiness scoring against approved bylaws, point calculation, and dossier prep — final decisions stay human.',
  },
  {
    icon: <BarChart3 size={22} />,
    titleAr: 'التقارير والظهور الأكاديمي',
    titleEn: 'Reports & Academic Visibility',
    descAr: 'تقارير مصدقة بصيغ PDF وWord وJSON، وملفات تعريف موحدة، وأصول علمية، ومعرّفات DOI وORCID.',
    descEn: 'Certified PDF/Word/JSON reports, unified academic profiles, scholarly assets, and DOI/ORCID identifiers.',
  },
  {
    icon: <ShieldCheck size={22} />,
    titleAr: 'الذكاء الاصطناعي الحوكمي',
    titleEn: 'Governed Academic AI',
    descAr: 'مساعد أكاديمي ذكي مدعوم بالحوكمة: قوالب موثوقة، عزل كامل بين المستأجرين، ومراجع منظمة، دون قرارات مستقلة.',
    descEn: 'Governed academic AI assistant: trusted templates, full tenant isolation, and organized citations — no autonomous decisions.',
  },
];

const PLANS = [
  {
    code: 'FREE',
    nameAr: 'الباقة المجانية',
    nameEn: 'Free Tier',
    priceAr: '0 ر.س',
    priceEn: '0 SAR',
    periodAr: 'شهريًا',
    periodEn: '/ month',
    highlight: false,
    featuresAr: ['3 مشاريع بحثية', '2 عضو', '100 ميجابايت تخزين', '5 تقارير شهريًا', 'تصدير PDF'],
    featuresEn: ['3 research projects', '2 team members', '100 MB storage', '5 reports / month', 'PDF export'],
  },
  {
    code: 'STARTER',
    nameAr: 'الباحث المحترف',
    nameEn: 'Researcher Starter',
    priceAr: '99 ر.س',
    priceEn: '99 SAR',
    periodAr: 'شهريًا',
    periodEn: '/ month',
    highlight: false,
    featuresAr: ['15 مشروع بحثي', '10 أعضاء', '2 جيجابايت تخزين', '50 تقرير شهريًا', 'تصدير PDF + Word', 'تقارير متقدمة', 'مساعد ذكاء اصطناعي'],
    featuresEn: ['15 research projects', '10 team members', '2 GB storage', '50 reports / month', 'PDF + Word export', 'Advanced reporting', 'AI assistant'],
  },
  {
    code: 'PROFESSIONAL',
    nameAr: 'الفرق والمجموعات البحثية',
    nameEn: 'Research Groups',
    priceAr: '299 ر.س',
    priceEn: '299 SAR',
    periodAr: 'شهريًا',
    periodEn: '/ month',
    highlight: true,
    featuresAr: ['100 مشروع بحثي', '50 عضو', '20 جيجابايت تخزين', '500 تقرير شهريًا', 'نظام التحكيم الكامل', 'محرك الترقيات', 'محكمون خارجيون', 'مساعد ذكاء اصطناعي متقدم'],
    featuresEn: ['100 research projects', '50 team members', '20 GB storage', '500 reports / month', 'Full peer review portal', 'Promotion engine', 'External referees', 'Advanced AI assistant'],
  },
  {
    code: 'INSTITUTIONAL',
    nameAr: 'المؤسسات والجامعات',
    nameEn: 'Institutional Enterprise',
    priceAr: '999 ر.س',
    priceEn: '999 SAR',
    periodAr: 'شهريًا',
    periodEn: '/ month',
    highlight: false,
    featuresAr: ['مشاريع غير محدودة', 'أعضاء غير محدودين', 'تخزين غير محدود', 'تقارير غير محدودة', 'ترخيص مؤسسي', 'دعم مخصص', 'عزل سيادي كامل'],
    featuresEn: ['Unlimited projects', 'Unlimited members', 'Unlimited storage', 'Unlimited reports', 'Institutional license', 'Dedicated support', 'Full sovereign isolation'],
  },
];

const FAQ = [
  {
    qAr: 'هل المنصة مناسبة للباحثين المستقلين؟',
    qEn: 'Is the platform suitable for independent researchers?',
    aAr: 'نعم، الباقة المجانية مصممة للباحثين المستقلين وتشمل أدوات تصميم الدراسات ومخططات البحث الأساسية كاملة.',
    aEn: 'Yes — the Free tier is built for independent researchers and includes the full core study-design blueprint tools.',
  },
  {
    qAr: 'هل يمكن للجامعات والمراكز البحثية استخدام المنصة؟',
    qEn: 'Can universities and research centers use the platform?',
    aAr: 'نعم، توفر الباقة المؤسسية ترخيصًا غير محدود للأعضاء والمشاريع مع دعم مخصص وعزل سيادي كامل للبيانات.',
    aEn: 'Yes — the Institutional tier provides unlimited members and projects with dedicated support and full sovereign data isolation.',
  },
  {
    qAr: 'كيف يتم الحفاظ على خصوصية التحكيم العلمي؟',
    qEn: 'How is peer review privacy preserved?',
    aAr: 'نظام التحكيم مزدوج التعمية: هوية المحكمين وتعليقاتهم السرية للمحرر لا تظهر للمؤلفين إطلاقًا، مع عزل كامل بين المؤسسات.',
    aEn: 'The review system is double-blind: reviewer identities and confidential-to-editor comments never reach authors, with strict cross-tenant isolation.',
  },
  {
    qAr: 'هل يتخذ الذكاء الاصطناعي قرارات الترقية أو التحكيم؟',
    qEn: 'Does the AI make promotion or editorial decisions?',
    aAr: 'لا. الذكاء الاصطناعي يساعد في التلخيص والصياغة وتنظيم الشواهد فقط؛ جميع القرارات النهائية تبقى بيد البشر.',
    aEn: 'No. The AI only assists with summaries, drafting, and evidence organization; all final decisions remain under human authority.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ language, onNavigateToLogin }) => {
  const isAr = language === 'ar';
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[#05090f] text-zinc-100 font-sans">
      {/* ── Top Navigation ── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-200 ${scrolled ? 'bg-[#05090f]/90 backdrop-blur-md border-b border-white/5 py-2' : 'py-4'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/20">
              <Brain size={20} />
            </div>
            <div>
              <span className="text-sm font-black tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-teal-300 to-cyan-300">
                {isAr ? 'بصيرة' : 'BASEERAH'}
              </span>
              <span className="text-[9px] font-bold text-zinc-500 block">V{PLATFORM_VERSION}</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-zinc-400">
            <button onClick={() => scrollTo('features')} className="hover:text-teal-300 transition-colors cursor-pointer">{isAr ? 'المميزات' : 'Features'}</button>
            <button onClick={() => scrollTo('how')} className="hover:text-teal-300 transition-colors cursor-pointer">{isAr ? 'كيف تعمل' : 'How it works'}</button>
            <button onClick={() => scrollTo('pricing')} className="hover:text-teal-300 transition-colors cursor-pointer">{isAr ? 'الباقات' : 'Pricing'}</button>
            <button onClick={() => scrollTo('faq')} className="hover:text-teal-300 transition-colors cursor-pointer">{isAr ? 'الأسئلة الشائعة' : 'FAQ'}</button>
            <button onClick={() => scrollTo('contact')} className="hover:text-teal-300 transition-colors cursor-pointer">{isAr ? 'تواصل معنا' : 'Contact'}</button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToLogin}
              className="px-4 py-2 rounded-xl text-xs font-black border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-200 transition-colors cursor-pointer"
            >
              {isAr ? 'تسجيل الدخول' : 'Sign in'}
            </button>
            <button
              onClick={() => scrollTo('pricing')}
              className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white shadow-lg shadow-teal-500/20 transition-all cursor-pointer"
            >
              {isAr ? 'ابدأ مجانًا' : 'Start free'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative pt-36 pb-20 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-[25%] right-[10%] w-[60vw] h-[60vw] rounded-full bg-teal-600/10 blur-[120px]" />
          <div className="absolute top-[30%] -left-[15%] w-[40vw] h-[40vw] rounded-full bg-cyan-700/10 blur-[120px]" />
          <div className="absolute bottom-0 left-[40%] w-[30vw] h-[30vw] rounded-full bg-emerald-700/5 blur-[100px]" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-400/25 bg-teal-500/10 text-teal-300 text-[10px] font-black mb-6">
            <Sparkles size={12} />
            <span>{isAr ? `الإصدار ${PLATFORM_VERSION} — منصة البصيرة للبحث العلمي` : `Version ${PLATFORM_VERSION} — Baseerah Academic Suite`}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black leading-tight tracking-tight m-0">
            {isAr ? (
              <>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-300 via-cyan-300 to-emerald-300">
                  المختبر الأكاديمي الذكي
                </span>
                <br />
                للبحث العلمي المتكامل
              </>
            ) : (
              <>
                The Intelligent Academic
                <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-300 via-cyan-300 to-emerald-300">
                  Research Laboratory
                </span>
              </>
            )}
          </h1>

          <p className="max-w-2xl mx-auto mt-6 text-sm sm:text-base text-zinc-400 leading-relaxed font-medium">
            {isAr
              ? 'منصة سحابية متكاملة (SaaS) لتصميم الدراسات، التحليل الإحصائي، محاكاة السيناريوهات، التحكيم العلمي مزدوج التعمية، محرك الترقيات، والتقارير المصدقة — مع عزل سيادي كامل للبيانات وذكاء اصطناعي حوكمي.'
              : 'An all-in-one SaaS platform for study design, statistical analysis, scenario simulation, double-blind peer review, promotion engine, and certified reporting — with full sovereign data isolation and governed AI.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <button
              onClick={onNavigateToLogin}
              className="flex items-center gap-2 px-7 py-3 rounded-2xl text-sm font-black bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white shadow-xl shadow-teal-500/25 transition-all cursor-pointer"
            >
              <span>{isAr ? 'ابدأ رحلتك البحثية مجانًا' : 'Start your research journey free'}</span>
              {isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
            </button>
            <button
              onClick={() => scrollTo('pricing')}
              className="px-7 py-3 rounded-2xl text-sm font-black border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-200 transition-colors cursor-pointer"
            >
              {isAr ? 'استعرض الباقات' : 'View pricing'}
            </button>
          </div>

          {/* Trust stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto">
            {[
              { value: '6', labelAr: 'وحدات بحثية متكاملة', labelEn: 'Integrated modules' },
              { value: '4', labelAr: 'باقات مرنة', labelEn: 'Flexible plans' },
              { value: '100%', labelAr: 'عزل سيادي للبيانات', labelEn: 'Sovereign isolation' },
              { value: PLATFORM_VERSION, labelAr: 'الإصدار الحالي', labelEn: 'Current version' },
            ].map((s, i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <div className="text-xl font-black text-teal-300">{s.value}</div>
                <div className="text-[10px] font-bold text-zinc-500 mt-1">{isAr ? s.labelAr : s.labelEn}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section id="features" className="py-20 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[10px] font-black uppercase tracking-widest text-teal-400">{isAr ? 'المميزات' : 'Features'}</span>
            <h2 className="text-2xl sm:text-4xl font-black mt-2 m-0">
              {isAr ? 'كل ما يحتاجه الباحث في منصة واحدة' : 'Everything a researcher needs, in one platform'}
            </h2>
            <p className="text-xs text-zinc-500 font-semibold mt-3 max-w-xl mx-auto">
              {isAr ? 'ست وحدات متكاملة تغطي دورة البحث كاملة من التصميم إلى النشر والاعتماد.' : 'Six integrated modules covering the full research lifecycle from design to publication.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div key={i} className="group rounded-3xl border border-white/5 bg-white/[0.02] p-6 hover:border-teal-400/25 hover:bg-teal-500/[0.03] transition-all duration-200">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-teal-500/20 to-cyan-500/10 text-teal-300 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="text-sm font-black m-0">{isAr ? f.titleAr : f.titleEn}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed font-medium mt-2">{isAr ? f.descAr : f.descEn}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="py-20 px-4 sm:px-6 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[10px] font-black uppercase tracking-widest text-teal-400">{isAr ? 'كيف تعمل' : 'How it works'}</span>
            <h2 className="text-2xl sm:text-4xl font-black mt-2 m-0">{isAr ? 'رحلة البحث في أربع خطوات' : 'Your research journey in four steps'}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <GraduationCap size={20} />, step: '01', titleAr: 'أنشئ دراستك', titleEn: 'Design your study', descAr: 'صمّم منهجية دراستك مع حاسبات حجم العينة والقوة الإحصائية.', descEn: 'Design your methodology with sample size and power calculators.' },
              { icon: <GitBranch size={20} />, step: '02', titleAr: 'حلل وواصل الدراسات', titleEn: 'Analyze & synthesize', descAr: 'حوّل البيانات، نفّذ التحليلات الإحصائية، وقم بتجميع الأدبيات.', descEn: 'Run statistics, synthesize literature, and manage your data.' },
              { icon: <FileCheck2 size={20} />, step: '03', titleAr: 'راجع وانشر', titleEn: 'Review & publish', descAr: 'أرسل للتحكيم مزدوج التعمية وجهّز تقاريرك المصدقة.', descEn: 'Submit for double-blind review and generate certified reports.' },
              { icon: <Crown size={20} />, step: '04', titleAr: 'ترقَّ واظهر', titleEn: 'Advance & get visible', descAr: 'جهّز ملف الترقية الأكاديمية وعزّز حضورك الأكاديمي ومعرّفاتك.', descEn: 'Prepare your promotion dossier and boost your academic visibility.' },
            ].map((s, i) => (
              <div key={i} className="relative rounded-3xl border border-white/5 bg-white/[0.02] p-6">
                <div className="absolute top-4 end-4 text-3xl font-black text-white/5">{s.step}</div>
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-300 flex items-center justify-center mb-4">{s.icon}</div>
                <h3 className="text-sm font-black m-0">{isAr ? s.titleAr : s.titleEn}</h3>
                <p className="text-xs text-zinc-500 font-medium leading-relaxed mt-2">{isAr ? s.descAr : s.descEn}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Section ── */}
      <section id="pricing" className="py-20 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[10px] font-black uppercase tracking-widest text-teal-400">{isAr ? 'الباقات' : 'Pricing'}</span>
            <h2 className="text-2xl sm:text-4xl font-black mt-2 m-0">{isAr ? 'خطط تناسب كل مرحلة بحثية' : 'Plans for every research stage'}</h2>
            <p className="text-xs text-zinc-500 font-semibold mt-3 max-w-xl mx-auto">
              {isAr
                ? 'ابدأ مجانًا وارتقِ عندما تنمو احتياجاتك. جميع الباقات تشمل التحديثات والدعم الفني.'
                : 'Start free and scale as your needs grow. All plans include updates and technical support.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {PLANS.map((p) => (
              <div
                key={p.code}
                className={`relative rounded-3xl border p-6 flex flex-col ${
                  p.highlight
                    ? 'border-teal-400/40 bg-gradient-to-b from-teal-500/10 to-transparent shadow-xl shadow-teal-500/10'
                    : 'border-white/8 bg-white/[0.02]'
                }`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-[9px] font-black">
                    {isAr ? 'الأكثر شيوعًا' : 'Most popular'}
                  </div>
                )}
                <h3 className="text-sm font-black m-0">{isAr ? p.nameAr : p.nameEn}</h3>
                <div className="flex items-baseline gap-1.5 mt-3">
                  <span className="text-3xl font-black text-white">{isAr ? p.priceAr : p.priceEn}</span>
                  <span className="text-[10px] font-bold text-zinc-500">{isAr ? p.periodAr : p.periodEn}</span>
                </div>
                <ul className="flex-1 space-y-2 mt-5 text-xs font-semibold text-zinc-400">
                  {(isAr ? p.featuresAr : p.featuresEn).map((f, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <Check size={13} className="text-teal-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={onNavigateToLogin}
                  className={`mt-6 w-full py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                    p.highlight
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white'
                      : 'border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-200'
                  }`}
                >
                  {isAr ? 'اختر الباقة' : 'Choose plan'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 px-4 sm:px-6 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-[10px] font-black uppercase tracking-widest text-teal-400">{isAr ? 'الأسئلة الشائعة' : 'FAQ'}</span>
            <h2 className="text-2xl sm:text-3xl font-black mt-2 m-0">{isAr ? 'أسئلة تتكرر كثيرًا' : 'Frequently asked questions'}</h2>
          </div>
          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-xs font-black text-zinc-200 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  aria-expanded={openFaq === i}
                >
                  <span>{isAr ? f.qAr : f.qEn}</span>
                  <ChevronDown size={14} className={`text-teal-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-xs text-zinc-500 font-medium leading-relaxed">
                    {isAr ? f.aAr : f.aEn}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact Section ── */}
      <section id="contact" className="py-20 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-teal-400">{isAr ? 'تواصل معنا' : 'Contact us'}</span>
          <h2 className="text-2xl sm:text-3xl font-black mt-2 m-0">{isAr ? 'نحن هنا لمساعدتك' : 'We are here to help'}</h2>
          <p className="text-xs text-zinc-500 font-semibold mt-3">
            {isAr
              ? 'للاستفسارات حول الباقات والاشتراكات أو الدعم الفني، تواصل معنا مباشرة.'
              : 'For questions about plans, subscriptions, or technical support, reach out to us directly.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="group rounded-3xl border border-white/8 bg-white/[0.02] p-6 hover:border-teal-400/30 hover:bg-teal-500/[0.03] transition-all"
            >
              <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-300 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Mail size={18} />
              </div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{isAr ? 'البريد الإلكتروني' : 'Email'}</div>
              <div className="text-sm font-black text-zinc-200 mt-1 break-all" dir="ltr">{CONTACT_EMAIL}</div>
            </a>
            <a
              href={`tel:${CONTACT_PHONE}`}
              className="group rounded-3xl border border-white/8 bg-white/[0.02] p-6 hover:border-teal-400/30 hover:bg-teal-500/[0.03] transition-all"
            >
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-300 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Phone size={18} />
              </div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{isAr ? 'رقم الجوال' : 'Phone'}</div>
              <div className="text-sm font-black text-zinc-200 mt-1" dir="ltr">{CONTACT_PHONE}</div>
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-4 sm:px-6 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white">
              <Brain size={16} />
            </div>
            <div>
              <span className="text-xs font-black tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-teal-300 to-cyan-300">
                {isAr ? 'بصيرة للبحث العلمي' : 'Baseerah Academic Suite'}
              </span>
              <span className="text-[9px] font-bold text-zinc-500 block">V{PLATFORM_VERSION}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] font-bold text-zinc-500">
            <button onClick={() => scrollTo('features')} className="hover:text-teal-300 cursor-pointer">{isAr ? 'المميزات' : 'Features'}</button>
            <button onClick={() => scrollTo('pricing')} className="hover:text-teal-300 cursor-pointer">{isAr ? 'الباقات' : 'Pricing'}</button>
            <button onClick={() => scrollTo('faq')} className="hover:text-teal-300 cursor-pointer">{isAr ? 'الأسئلة' : 'FAQ'}</button>
            <button onClick={() => scrollTo('contact')} className="hover:text-teal-300 cursor-pointer">{isAr ? 'التواصل' : 'Contact'}</button>
          </div>

          <div className="flex items-center gap-4 text-[10px] font-bold text-zinc-500">
            <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-1.5 hover:text-teal-300"><Mail size={12} /> <span dir="ltr">{CONTACT_EMAIL}</span></a>
            <a href={`tel:${CONTACT_PHONE}`} className="flex items-center gap-1.5 hover:text-teal-300"><Phone size={12} /> <span dir="ltr">{CONTACT_PHONE}</span></a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-6 pt-6 border-t border-white/5 text-center text-[10px] text-zinc-600 font-semibold">
          © {new Date().getFullYear()} {isAr ? 'بصيرة للبحث العلمي — جميع الحقوق محفوظة.' : 'Baseerah Academic Suite — All rights reserved.'} {isAr ? `الإصدار ${PLATFORM_VERSION}` : `Version ${PLATFORM_VERSION}`}
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;