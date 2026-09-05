import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Brain, Sparkles, Check, ChevronDown, Menu, X,
  Mail, Phone, ArrowLeft, ArrowRight, Globe,
} from 'lucide-react';
import { Button } from '../design-system/components/Button';
import { useProject } from '../context/ProjectContext';
import { FUNNEL_EVENTS, track } from '../utils/analytics';
import { rememberIntendedPlan } from './funnel';
import { CONTACT_EMAIL, CONTACT_PHONE } from './contact';
import { LeadForm } from './LeadForm';
import {
  NAV, PAGE_SEO, FEATURES, SOLUTIONS, STEPS, PLANS, FAQ,
  formatSar, planHref, planCta, type PlanCode,
} from './marketingContent';

export const MarketingSite: React.FC = () => {
  const { language, setLanguage, user } = useProject();
  const isAr = language === 'ar';
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('yearly');
  const [navOpen, setNavOpen] = useState(false);
  const page = location.pathname === '/home' ? '/' : location.pathname;
  const defaultIntent = searchParams.get('intent') || (page === '/contact' ? 'demo' : 'demo');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    setNavOpen(false);
    track(FUNNEL_EVENTS.pageView, { path: page });
    if (page === '/pricing') track(FUNNEL_EVENTS.viewPricing, { path: page });
  }, [page]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    if (navOpen) window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [navOpen]);

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
    if (page === '/features') return isAr ? 'ماذا تفعل المنصة في دورة البحث' : 'What Baseerah does in the research cycle';
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
      <a className="ds-skip-link" href="#main-content">
        {isAr ? 'تخطَّ إلى المحتوى الرئيسي' : 'Skip to main content'}
      </a>
      <header className={`fixed top-0 inset-x-0 z-50 ds-transition print:hidden ${scrolled ? 'baseerah-glass border-b border-[var(--ds-border-subtle)]' : ''} py-3`}>
        <div className="ds-shell px-4 sm:px-6 flex items-center justify-between gap-2 sm:gap-3">
          <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-2.5 no-underline text-inherit">
            <div className="p-2 rounded-xl bg-action text-on-action shadow-[var(--ds-shadow-glow)] shrink-0">
              <Brain size={20} />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold tracking-wide baseerah-gradient-text">{isAr ? 'بصيرة' : 'BASEERAH'}</span>
              <span className="text-caption font-bold text-[var(--ds-text-muted)] hidden min-[380px]:block">{isAr ? 'منصة دورة البحث العلمي' : 'Research lifecycle platform'}</span>
            </div>
          </Link>

          <nav className="hidden lg:flex flex-wrap items-center justify-end gap-x-3 gap-y-1 xl:gap-x-5 text-label text-[var(--ds-text-muted)]">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `ds-nav-underline hover:text-[var(--ds-primary-bright)] ds-transition no-underline ${isActive ? 'text-[var(--ds-primary-bright)] ds-nav-current' : 'text-[var(--ds-text-muted)]'}`
                }
              >
                {isAr ? item.ar : item.en}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setLanguage(isAr ? 'en' : 'ar')}
              className="inline-flex items-center gap-1 px-2 py-1.5 min-h-[36px] rounded-xl border border-[var(--ds-border-default)] text-caption font-bold text-[var(--ds-text-secondary)] cursor-pointer bg-transparent hover:bg-white/5 ds-transition"
            >
              <Globe size={12} />
              <span>{isAr ? 'EN' : 'عربي'}</span>
            </button>
            {user ? (
              <Button onClick={() => navigate('/app')} size="sm" className="hidden sm:inline-flex">
                {isAr ? 'مساحة العمل' : 'Open workspace'}
              </Button>
            ) : (
              <>
                <Button onClick={() => navigate('/login')} variant="outline" size="sm" className="hidden min-[480px]:inline-flex">
                  {isAr ? 'دخول' : 'Sign in'}
                </Button>
                <Button onClick={() => goRegister()} size="sm" className="hidden min-[400px]:inline-flex">
                  {isAr ? 'ابدأ مجانًا' : 'Start free'}
                </Button>
              </>
            )}
            <button
              type="button"
              className="lg:hidden p-2 min-h-[40px] min-w-[40px] rounded-xl border border-[var(--ds-border-default)] text-[var(--ds-text-secondary)] hover:bg-white/5 ds-transition cursor-pointer"
              aria-label={isAr ? 'فتح القائمة' : 'Open menu'}
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {navOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden print:hidden" role="dialog" aria-modal="true" aria-label={isAr ? 'قائمة الموقع' : 'Site menu'}>
          <div className="absolute inset-0 bg-[var(--ds-surface-overlay)] animate-fade-in" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 inset-inline-end-0 w-[min(88vw,20rem)] bg-[var(--ds-surface-primary)] border-inline-start border-[var(--ds-border-subtle)] shadow-[var(--ds-shadow-overlay)] p-5 flex flex-col gap-5 animate-slide-in">
            <div className="flex items-center justify-between">
              <span className="text-label text-[var(--ds-text-primary)]">{isAr ? 'التنقل' : 'Menu'}</span>
              <button type="button" onClick={() => setNavOpen(false)} aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'} className="p-2 rounded-xl hover:bg-white/5 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-xl px-3 py-2.5 text-body-sm no-underline ds-transition ${isActive ? 'bg-[var(--ds-primary-soft)] text-[var(--ds-primary-bright)]' : 'text-[var(--ds-text-secondary)] hover:bg-white/5'}`
                  }
                >
                  {isAr ? item.ar : item.en}
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-2">
              {user ? (
                <Button onClick={() => navigate('/app')} fullWidth>{isAr ? 'مساحة العمل' : 'Open workspace'}</Button>
              ) : (
                <>
                  <Button onClick={() => goRegister()} fullWidth>{isAr ? 'ابدأ مجانًا' : 'Start free'}</Button>
                  <Button onClick={() => navigate('/login')} variant="outline" fullWidth>{isAr ? 'دخول' : 'Sign in'}</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <main id="main-content" tabIndex={-1}>
      {showHome && (
        <section className="relative pt-36 pb-20 px-4 sm:px-6 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-[25%] right-[10%] w-[60vw] h-[60vw] rounded-full bg-[var(--ds-aurora-emerald)] blur-[120px]" />
            <div className="absolute top-[30%] -left-[15%] w-[40vw] h-[40vw] rounded-full bg-[var(--ds-aurora-gold)] blur-[120px]" />
          </div>
          <div className="relative max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--ds-accent-gold)]/25 bg-[var(--ds-accent-gold-soft)] text-[var(--ds-accent-gold-text)] text-caption font-bold mb-6">
              <Sparkles size={12} />
              <span>{isAr ? 'منصة سعودية لدورة البحث العلمي — ليست مولّد أوراق' : 'Saudi research-operations platform — not a paper generator'}</span>
            </div>
            <h1 className="text-display m-0">
              {isAr ? (
                <>
                  <span className="baseerah-gradient-text">من التصميم إلى الاعتماد</span>
                  {' '}
                  <br />
                  في مساحة بحثية واحدة
                </>
              ) : (
                <>
                  From study design to
                  {' '}
                  <br />
                  <span className="baseerah-gradient-text">institutional clearance</span>
                </>
              )}
            </h1>
            <p className="text-body-lg max-w-2xl mx-auto mt-6 text-[var(--ds-text-secondary)]">
              {isAr
                ? 'بصيرة تجمع تصميم الدراسة، الإحصاء، الأدبيات، التحكيم مزدوج التعمية، الترقيات، والرسائل الجامعية. القرار يبقى بشريًا، والبيانات معزولة لكل مؤسسة، والواجهة عربية وإنجليزية.'
                : 'Baseerah unifies study design, statistics, literature, double-blind review, promotions, and thesis operations. Humans decide, each institution stays isolated, and Arabic and English are first-class.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Button onClick={() => goRegister()} className="px-7 py-3 rounded-2xl text-sm font-black" iconAfter={isAr ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}>
                {isAr ? 'ابدأ مجانًا' : 'Start free'}
              </Button>
              <Button onClick={() => navigate('/pricing')} variant="outline" className="px-7 py-3 rounded-2xl text-sm font-black">
                {isAr ? 'شاهد الباقات' : 'See pricing'}
              </Button>
              <Button onClick={() => navigate('/contact?intent=demo')} variant="ghost" className="px-7 py-3 rounded-2xl text-sm font-black">
                {isAr ? 'اطلب عرضًا للجامعة' : 'Book a university demo'}
              </Button>
            </div>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-16 max-w-3xl mx-auto">
              {[
                { value: isAr ? 'دورة كاملة' : 'Full cycle', labelAr: 'تصميم → تحليل → تحكيم → ترقية', labelEn: 'Design → analysis → review → promotion' },
                { value: 'AR+EN', labelAr: 'عربي وإنجليزي أصلًا', labelEn: 'Arabic and English native' },
                { value: isAr ? 'بشري أولًا' : 'Human-first', labelAr: 'لا قرار ترقية أو قبول آلي', labelEn: 'No automated verdicts' },
                { value: isAr ? 'عزل مؤسسي' : 'Isolated', labelAr: 'بيانات كل جهة منفصلة', labelEn: 'Per-institution tenancy' },
              ].map((item) => (
                <div key={item.value} className="rounded-2xl border border-[var(--ds-border-subtle)] bg-white/[0.03] p-4">
                  <div className="text-sm font-black text-[var(--ds-accent-gold-text)]">{item.value}</div>
                  <div className="text-caption font-semibold text-[var(--ds-text-muted)] mt-1">{isAr ? item.labelAr : item.labelEn}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {!showHome && (
        <section className="relative pt-32 pb-10 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-overline text-[var(--ds-accent-gold-text)] m-0">
              {page === '/institutional'
                ? (isAr ? 'للجامعات' : 'Universities')
                : NAV.find((item) => item.to === page)
                  ? (isAr ? NAV.find((item) => item.to === page)?.ar : NAV.find((item) => item.to === page)?.en)
                  : ''}
            </p>
            <h1 className="text-h1 mt-2 m-0">{pageHeading}</h1>
          </div>
        </section>
      )}

      {showAbout && (
        <section className="py-8 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto space-y-4 text-sm leading-relaxed text-[var(--ds-text-secondary)] font-medium">
            <p>
              {isAr
                ? 'بصيرة منصة سحابية للجامعات والباحثين في السياق السعودي والعربي: تشغّل دورة البحث — من التصميم إلى الاعتماد — بدل أن تكتب الورقة نيابة عن المؤلف. لكل مؤسسة بياناتها وصلاحياتها وحدود استخدامها.'
                : 'Baseerah is cloud software for universities and researchers in the Saudi and Arabic academic context: it runs the research cycle — from design to clearance — instead of writing the paper for the author. Each institution keeps its own data, roles, and usage limits.'}
            </p>
            <p>
              {isAr
                ? 'القيمة ليست «ذكاء اصطناعي يطلق قرارات». القيمة أن المشرف واللجنة وعمادة الدراسات العليا يبقون أصحاب القرار، بينما تبقى الملفات والمنهجية والتحكيم والترقية في نظام واحد يمكن حوكمته.'
                : 'The value is not AI that issues verdicts. The value is that supervisors, committees, and graduate studies remain decision-makers, while method, review, and promotion live in one governable system.'}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="button" onClick={() => goRegister()}>{isAr ? 'ابدأ مجانًا' : 'Start free'}</Button>
              <Button type="button" variant="outline" onClick={() => navigate('/contact?intent=demo')}>{isAr ? 'اطلب عرضًا للجامعة' : 'Book a university demo'}</Button>
            </div>
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
              <h2 className="text-h2 text-[var(--ds-text-primary)] m-0">{isAr ? 'لمن هذا العرض' : 'Who this is for'}</h2>
              <ul className="m-0 ps-5 space-y-1">
                <li>{isAr ? 'عمادة الدراسات العليا: مسارات الرسالة، المناقشة، والممتحنون الخارجيون داخل عزل مؤسسي.' : 'Graduate studies: thesis paths, defense, and external examiners inside tenant isolation.'}</li>
                <li>{isAr ? 'الكليات والمجموعات البحثية: مساحة مشتركة بحدود أعضاء ومشاريع دون خلط بيانات الجهات.' : 'Colleges and research groups: a shared workspace with member and project limits, without mixing tenant data.'}</li>
                <li>{isAr ? 'لجان التحكيم والترقيات: شواهد منظمة وتحكيم مزدوج التعمية، والقرار يبقى بشريًا.' : 'Review and promotion committees: structured evidence and double-blind review, with human decisions.'}</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h2 className="text-h2 text-[var(--ds-text-primary)] m-0">{isAr ? 'ما الذي يُجرَّب بمعزل حقيقي' : 'What a real isolated trial includes'}</h2>
              <p>
                {isAr
                  ? 'بعد طلب العرض نفتح مؤسسة مستقلة ببياناتها الخاصة: حسابات أدوار (مالك، مشرف، باحث، مشاهد)، مشروع رسالة أو دراسة واحد، ومسار تحكيم أو ترقية حسب حاجة الجهة. لا تُخلط بيانات التجربة مع أي مستأجر آخر.'
                  : 'After the demo request we open a separate organization with its own data: role accounts (owner, supervisor, researcher, viewer), one thesis or study project, and a review or promotion path as needed. Trial data is never mixed with another tenant.'}
              </p>
            </div>
            <div className="space-y-2">
              <h2 className="text-h2 text-[var(--ds-text-primary)] m-0">{isAr ? 'التسعير المؤسسي' : 'Institutional pricing'}</h2>
              <p>
                {isAr
                  ? 'باقة المؤسسات: 999 ر.س شهريًا أو 9990 ر.س سنويًا (شهرين مجانًا على السنوي). الاشتراك عبر طلب عرض ومتابعة يدوية — ليس دفعًا ذاتيًا بالبطاقة اليوم.'
                  : 'Institutional plan: 999 SAR monthly or 9,990 SAR yearly (two months free on annual). Subscription is a sales-assisted demo — not self-serve card checkout today.'}
              </p>
            </div>
            <div className="space-y-2">
              <h2 className="text-h2 text-[var(--ds-text-primary)] m-0">{isAr ? 'الخطوة التالية' : 'Next step'}</h2>
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
          <div className="ds-shell">
            {showHome && (
              <div className="text-center mb-12">
                <span className="text-overline text-[var(--ds-accent-gold-text)]">{isAr ? 'لمن؟' : 'Who it is for'}</span>
                <h2 className="text-h2 mt-2 m-0">{isAr ? 'حل واحد، مسارات حسب الدور' : 'One platform, role-based paths'}</h2>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {SOLUTIONS.map((item) => (
                <div key={item.href + item.titleEn} className="rounded-3xl border border-[var(--ds-border-subtle)] bg-white/[0.03] p-6 flex flex-col">
                  <div className="h-10 w-10 rounded-xl bg-[var(--ds-primary-soft)] text-[var(--ds-primary-bright)] flex items-center justify-center mb-4">{item.icon}</div>
                  <h3 className="text-h3 m-0">{isAr ? item.titleAr : item.titleEn}</h3>
                  <p className="text-caption text-[var(--ds-text-muted)] font-medium mt-2 flex-1">{isAr ? item.descAr : item.descEn}</p>
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
          <div className="ds-shell">
            {showHome && (
              <div className="text-center mb-12">
                <span className="text-overline text-[var(--ds-accent-gold-text)]">{isAr ? 'المميزات' : 'Features'}</span>
                <h2 className="text-h2 mt-2 m-0">{isAr ? 'ماذا يُحل داخل المنصة' : 'What gets solved in-product'}</h2>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((feature) => (
                <div key={feature.titleEn} className="rounded-3xl border border-[var(--ds-border-subtle)] bg-white/[0.03] p-6">
                  <div className="h-11 w-11 rounded-2xl bg-[var(--ds-primary-soft)] text-[var(--ds-primary-bright)] flex items-center justify-center mb-4">{feature.icon}</div>
                  <h3 className="text-h3 m-0">{isAr ? feature.titleAr : feature.titleEn}</h3>
                  <p className="text-caption text-[var(--ds-text-muted)] font-medium mt-2">{isAr ? feature.descAr : feature.descEn}</p>
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
                <span className="text-overline text-[var(--ds-accent-gold-text)]">{isAr ? 'كيف تعمل' : 'How it works'}</span>
                <h2 className="text-h2 mt-2 m-0">{isAr ? 'أربع خطوات بعد التسجيل' : 'Four steps after signup'}</h2>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {STEPS.map((step) => (
                <div key={step.step} className="relative rounded-3xl border border-[var(--ds-border-subtle)] bg-white/[0.03] p-6">
                  <div className="absolute top-4 end-4 text-3xl font-black text-white/5">{step.step}</div>
                  <div className="h-10 w-10 rounded-xl bg-[var(--ds-accent-gold-soft)] text-[var(--ds-accent-gold-text)] flex items-center justify-center mb-4">{step.icon}</div>
                  <h3 className="text-h3 m-0">{isAr ? step.titleAr : step.titleEn}</h3>
                  <p className="text-caption text-[var(--ds-text-muted)] font-medium mt-2">{isAr ? step.descAr : step.descEn}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-10">
              <Button type="button" onClick={() => goRegister()}>{isAr ? 'ابدأ الخطوة الأولى مجانًا' : 'Start the first step free'}</Button>
            </div>
          </div>
        </section>
      )}

      {showPricing && (
        <section id="pricing" className="py-16 px-4 sm:px-6 border-t border-[var(--ds-border-subtle)]">
          <div className="ds-shell">
            <div className="text-center mb-10">
              {showHome && (
                <>
                  <span className="text-overline text-[var(--ds-accent-gold-text)]">{isAr ? 'الباقات' : 'Pricing'}</span>
                  <h2 className="text-h2 mt-2 m-0">{isAr ? 'ابدأ مجانًا. ادفع عندما يكبر الفريق.' : 'Start free. Pay when the team grows.'}</h2>
                </>
              )}
              <p className="text-caption text-[var(--ds-text-muted)] font-semibold mt-3 max-w-xl mx-auto">
                {isAr
                  ? 'الأسعار بالريال السعودي. الاشتراك السنوي يوفّر شهرين. الباقات المدفوعة تُفعَّل من داخل الحساب؛ ابدأ مجانًا اليوم.'
                  : 'Prices in SAR. Annual billing saves two months. Paid plans activate from inside the account; start free today.'}
              </p>
              <div className="inline-flex mt-5 rounded-full border border-[var(--ds-border-subtle)] p-1">
                <button
                  type="button"
                  className={`px-4 py-1.5 rounded-full text-caption font-bold cursor-pointer ${billingInterval === 'monthly' ? 'bg-action text-on-action' : 'bg-transparent text-[var(--ds-text-muted)]'}`}
                  onClick={() => setBillingInterval('monthly')}
                >
                  {isAr ? 'شهري' : 'Monthly'}
                </button>
                <button
                  type="button"
                  className={`px-4 py-1.5 rounded-full text-caption font-bold cursor-pointer ${billingInterval === 'yearly' ? 'bg-action text-on-action' : 'bg-transparent text-[var(--ds-text-muted)]'}`}
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
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--ds-accent-gold)] text-[var(--ds-navy)] text-caption font-bold">
                        {isAr ? 'الأكثر ملاءمة للفرق' : 'Best for teams'}
                      </div>
                    )}
                    <h3 className="text-h3 m-0">{isAr ? plan.nameAr : plan.nameEn}</h3>
                    <p className="text-caption font-semibold text-[var(--ds-text-muted)] mt-1 m-0">{isAr ? plan.audienceAr : plan.audienceEn}</p>
                    <div className="flex items-baseline gap-1.5 mt-3">
                      <span className="text-3xl font-black text-[var(--ds-text-primary)]">{formatSar(price, isAr)}</span>
                      <span className="text-caption font-semibold text-[var(--ds-text-muted)]">{period}</span>
                    </div>
                    {billingInterval === 'yearly' && plan.monthly > 0 && (
                      <p className="text-caption text-[var(--ds-text-muted)] mt-1 m-0">
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
                <span className="text-overline text-[var(--ds-accent-gold-text)]">{isAr ? 'الأسئلة الشائعة' : 'FAQ'}</span>
                <h2 className="text-h2 mt-2 m-0">{isAr ? 'قبل أن تنشئ الحساب' : 'Before you create an account'}</h2>
              </div>
            )}
            <div className="space-y-3">
              {FAQ.map((item, index) => (
                <div key={item.qEn} className="rounded-2xl border border-[var(--ds-border-subtle)] bg-white/[0.03] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="w-full flex items-center justify-between px-5 py-4 text-xs font-black text-[var(--ds-text-primary)] cursor-pointer bg-transparent border-0 hover:bg-white/[0.04] ds-transition"
                    aria-expanded={openFaq === index}
                  >
                    <span>{isAr ? item.qAr : item.qEn}</span>
                    <ChevronDown size={14} className={`text-[var(--ds-accent-gold-text)] ds-transition ${openFaq === index ? 'rotate-180' : ''}`} />
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
                  <span className="text-overline text-[var(--ds-accent-gold-text)]">{isAr ? 'الخطوة التالية' : 'Next step'}</span>
                  <h2 className="text-h2 mt-2 m-0">{isAr ? 'باحث؟ ابدأ. جامعة؟ اطلب عرضًا.' : 'Researcher? Start. University? Book a demo.'}</h2>
                </>
              )}
              <p className="text-caption text-[var(--ds-text-muted)] font-semibold mt-3">
                {isAr
                  ? 'للباحث: أنشئ حسابًا مجانيًا خلال دقائق. للكلية أو العمادة: اترك بياناتك وسنعود إليك بمسار مؤسسي.'
                  : 'Researchers can create a free account in minutes. Colleges and graduate offices can leave details for an institutional conversation.'}
              </p>
              <p className="text-caption font-bold mt-3 m-0">
                <Link to="/institutional" className="text-[var(--ds-primary-bright)] no-underline">
                  {isAr ? 'اقرأ الموجز التشغيلي للجامعة (قابل للطباعة)' : 'Read the printable university brief'}
                </Link>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                <a href={`mailto:${CONTACT_EMAIL}`} className="rounded-3xl border border-[var(--ds-border-subtle)] bg-white/[0.03] p-5 no-underline ds-transition hover:border-[var(--ds-primary)]/40 hover:bg-white/[0.06]">
                  <Mail size={18} className="text-[var(--ds-primary-bright)] mb-2" />
                  <div className="text-caption font-semibold text-[var(--ds-text-muted)]">{isAr ? 'البريد' : 'Email'}</div>
                  <div className="text-sm font-black text-[var(--ds-text-primary)] mt-1 break-all" dir="ltr">{CONTACT_EMAIL}</div>
                </a>
                <a href={`tel:${CONTACT_PHONE}`} className="rounded-3xl border border-[var(--ds-border-subtle)] bg-white/[0.03] p-5 no-underline ds-transition hover:border-[var(--ds-primary)]/40 hover:bg-white/[0.06]">
                  <Phone size={18} className="text-[var(--ds-accent-gold-text)] mb-2" />
                  <div className="text-caption font-semibold text-[var(--ds-text-muted)]">{isAr ? 'الجوال' : 'Phone'}</div>
                  <div className="text-sm font-black text-[var(--ds-text-primary)] mt-1" dir="ltr">{CONTACT_PHONE}</div>
                </a>
              </div>
            </div>
            <div className="rounded-3xl border border-[var(--ds-border-subtle)] bg-white/[0.03] p-6">
              <h3 className="text-h3 m-0 mb-4">{isAr ? 'نموذج طلب تواصل' : 'Contact form'}</h3>
              <LeadForm isAr={isAr} defaultIntent={defaultIntent} compact={showHome} />
            </div>
          </div>
        </section>
      )}
      </main>

      <footer className="py-10 px-4 sm:px-6 border-t border-[var(--ds-border-subtle)] bg-[color-mix(in_srgb,var(--ds-surface-primary)_40%,transparent)] print:hidden">
        <div className="ds-shell grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] items-center gap-6">
          <Link to="/" className="flex items-center justify-center lg:justify-start gap-2.5 no-underline text-inherit">
            <div className="p-2 rounded-xl bg-action text-on-action"><Brain size={16} /></div>
            <div>
              <span className="text-caption font-bold tracking-wide baseerah-gradient-text">{isAr ? 'بصيرة للبحث العلمي' : 'Baseerah'}</span>
              <span className="text-caption font-medium text-[var(--ds-text-muted)] block">{isAr ? 'منصة دورة البحث العلمي' : 'Research lifecycle platform'}</span>
            </div>
          </Link>
          <nav className="flex flex-wrap items-center justify-center lg:justify-end gap-x-5 gap-y-2 text-caption font-semibold text-[var(--ds-text-muted)]">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className="hover:text-[var(--ds-primary-bright)] no-underline text-inherit ds-transition">{isAr ? item.ar : item.en}</Link>
            ))}
            <Link to="/login" className="hover:text-[var(--ds-primary-bright)] no-underline text-inherit ds-transition">{isAr ? 'دخول' : 'Sign in'}</Link>
          </nav>
        </div>
        <div className="ds-shell mt-6 pt-6 border-t border-[var(--ds-border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3 text-center text-caption text-[var(--ds-text-muted)] font-medium">
          <span>© {new Date().getFullYear()} {isAr ? 'بصيرة للبحث العلمي — جميع الحقوق محفوظة.' : 'Baseerah — All rights reserved.'}</span>
          <span className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-[var(--ds-primary-bright)] no-underline text-inherit ds-transition">{isAr ? 'الشروط والأحكام' : 'Terms of Service'}</Link>
            <Link to="/privacy" className="hover:text-[var(--ds-primary-bright)] no-underline text-inherit ds-transition">{isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default MarketingSite;
