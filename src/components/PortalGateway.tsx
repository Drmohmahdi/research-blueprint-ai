import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { Card } from '../design-system/components/Card';
import { Button } from '../design-system/components/Button';
import { PathPanel } from '../design-system/components/Navigation';
import { apiGetMyProfile, apiListScholarlyAssets, apiListPeerReviewCases, apiGetMyReviewerAssignments, apiGetMyPromotionApplication, apiResendVerification, type ReviewerAssignmentData } from '../utils/api';
import { 
  FlaskConical, 
  BookOpen, 
  Award, 
  Briefcase, 
  ChevronRight, 
  ShieldCheck,
  Globe,
  Activity
} from 'lucide-react';
import { ROUTES } from '../router/routes';
import { readIntendedPlan } from '../marketing/funnel';

export const PortalGateway: React.FC = () => {
  const { activeProject, language, projects, user } = useProject();
  const navigate = useNavigate();
  const isAr = language === 'ar';

  const [profile, setProfile] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [peerCases, setPeerCases] = useState<Array<{ status: string }>>([]);
  const [reviewAssignments, setReviewAssignments] = useState<ReviewerAssignmentData[]>([]);
  const [promotionApp, setPromotionApp] = useState<{ status: string; readiness_percentage: number; evidence_selections?: unknown[] } | null>(null);
  const [metricsStatus, setMetricsStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [p, a, cases, assignments, promo] = await Promise.all([
          apiGetMyProfile(),
          apiListScholarlyAssets(),
          apiListPeerReviewCases(),
          apiGetMyReviewerAssignments(),
          apiGetMyPromotionApplication(),
        ]);
        if (p) setProfile(p);
        if (a) setAssets(a);
        if (cases) setPeerCases(cases);
        if (assignments) setReviewAssignments(assignments);
        if (promo) setPromotionApp(promo);
        setMetricsStatus(p || a ? 'ready' : 'unavailable');
      } catch (e) {
        console.error("Failed to load portal metrics", e);
        setMetricsStatus('unavailable');
      }
    };
    load();
  }, []);

  const journalPapersCount = assets.filter(a => a.asset_type === 'JOURNAL_PAPER').length;
  const manuscriptCount = assets.filter(a => a.asset_type === 'MANUSCRIPT').length;
  const inSubmissionCount = assets.filter(a => String(a.lifecycle_status || '').includes('SUBMIT')).length;
  const completeness = profile?.completeness_score || 0;
  const channelsCount = profile?.identifiers?.length || 0;
  const totalAssetsCount = assets.length;
  const identifierTypes = (profile?.identifiers || []).map((item: { identifier_type?: string }) => item.identifier_type).filter(Boolean);
  const duplicateChannels = identifierTypes.filter((type: string, index: number) => identifierTypes.indexOf(type) !== index).length;
  const researchOpenTasks = [
    !activeProject,
    !activeProject?.preRegistrationHash,
    !(activeProject?.questions?.length),
    !(activeProject?.hypotheses?.length),
  ].filter(Boolean).length;
  const openActions = [
    !activeProject?.preRegistrationHash,
    completeness < 100,
    channelsCount < 6
  ].filter(Boolean).length;
  const dash = (value: string) => metricsStatus === 'ready' ? value : metricsStatus === 'loading' ? '...' : '—';
  const activeReviews = peerCases.filter(c => c.status === 'IN_REVIEW' || c.status === 'REVISION_REQUESTED').length;
  const completedReviews = peerCases.filter(c => c.status === 'DECIDED').length;
  const pendingReports = peerCases.filter(c => c.status === 'DRAFT').length + reviewAssignments.filter(a => a.status === 'INVITED' || a.status === 'ACCEPTED' || a.status === 'IN_PROGRESS').length;
  const nextDue = reviewAssignments
    .map(a => a.due_at)
    .filter((d): d is string => Boolean(d))
    .sort()[0];
  const nextDueLabel = nextDue
    ? new Date(nextDue).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')
    : (isAr ? 'لا يوجد' : 'None');
  const intendedPlan = readIntendedPlan();
  const needsEmail = user?.email_verified === false;
  const hasProject = Boolean(activeProject) || projects.length > 0;
  const publicProfileUrl = user?.username ? `${window.location.origin}/researcher/${encodeURIComponent(user.username)}` : '';
  const profileReady = completeness >= 40 || channelsCount > 0;

  const resendVerification = async () => {
    const result = await apiResendVerification();
    setResendMsg(
      result?.ok
        ? (isAr ? 'أُعيد إرسال رابط التأكيد إن كان البريد مضبوطًا.' : 'A confirmation link was reissued if email is configured.')
        : (isAr ? 'تعذر إعادة الإرسال الآن.' : 'Could not resend just now.')
    );
  };
  const revisionRequested = peerCases.filter(c => c.status === 'REVISION_REQUESTED').length;
  const metricsValue = dash;
  const portalSummary = [
    {
      label: isAr ? 'اكتمال الملف' : 'Profile',
      value: metricsValue(`${completeness}%`)
    },
    {
      label: isAr ? 'الأصول العلمية' : 'Assets',
      value: metricsValue(String(totalAssetsCount))
    },
    {
      label: isAr ? 'القنوات المرتبطة' : 'Channels',
      value: metricsValue(`${channelsCount}/6`)
    },
    {
      label: isAr ? 'إجراءات مفتوحة' : 'Open actions',
      value: metricsValue(String(openActions))
    }
  ];

  const modules = [
    {
      id: 'research',
      titleAr: 'بصيرة للبحث العلمي',
      titleEn: 'Baseerah Research',
      descAr: 'صمم دراستك، وابنِ نموذجها المنهجي، وحدد العينة، وحاكِ النتائج، وتابع تنفيذها وحلل مخرجاتها.',
      descEn: 'Design your study, build its conceptual model, calculate sample sizes, simulate outcomes, and monitor research execution.',
      icon: FlaskConical,
      accent: 'var(--ds-path-research)',
      path: activeProject ? ROUTES.LIFECYCLE : ROUTES.PATHS,
      statusAr: activeProject ? 'جاهز للعمل' : 'بانتظار مشروع',
      statusEn: activeProject ? 'Ready' : 'Needs a project',
      nextActionAr: activeProject ? 'متابعة دورة حياة المشروع النشط' : 'أنشئ أو اختر مشروعًا بحثيًا',
      nextActionEn: activeProject ? 'Continue the active project lifecycle' : 'Create or select a research project',
      stats: isAr ? [
        { label: 'المشروعات البحثية', value: String(projects.length) },
        { label: 'المشروع النشط', value: activeProject ? '1' : '0' },
        { label: 'المهام المفتوحة', value: String(researchOpenTasks) },
        { label: 'آخر مشروع', value: activeProject?.titleAr ? (activeProject.titleAr.substring(0, 30) + '...') : 'لا يوجد' }
      ] : [
        { label: 'Research Projects', value: String(projects.length) },
        { label: 'Active Project', value: activeProject ? '1' : '0' },
        { label: 'Open Tasks', value: String(researchOpenTasks) },
        { label: 'Last Project', value: activeProject?.titleEn ? (activeProject.titleEn.substring(0, 30) + '...') : 'None' }
      ]
    },
    {
      id: 'publishing',
      titleAr: 'بصيرة للنشر العلمي',
      titleEn: 'Baseerah Publishing',
      descAr: 'راجع مخطوطتك، وقِس جاهزيتها، واختر المجلة المناسبة، وجهز حزمة التقديم، وتابع التحكيم والتعديلات.',
      descEn: 'Review your manuscript, evaluate journal match, prepare submission packages, and track peer review revisions.',
      icon: BookOpen,
      accent: 'var(--ds-path-publication)',
      path: ROUTES.PUBLISHING,
      statusAr: manuscriptCount ? 'يحتاج مراجعة' : 'لا مخطوطة بعد',
      statusEn: manuscriptCount ? 'Needs review' : 'No manuscript yet',
      nextActionAr: manuscriptCount ? 'فتح مركز ذكاء النشر' : 'أنشئ مخطوطة من مشروع بحثي',
      nextActionEn: manuscriptCount ? 'Open publication intelligence' : 'Create a manuscript from a research project',
      stats: isAr ? [
        { label: 'المخطوطات (السجل الموحد)', value: dash(String(manuscriptCount)) },
        { label: 'الأوراق المحكمة', value: dash(String(journalPapersCount)) },
        { label: 'ملفات قيد التقديم', value: dash(String(inSubmissionCount)) },
        { label: 'تعديلات مطلوبة', value: dash(String(revisionRequested)) }
      ] : [
        { label: 'Manuscripts (Unified)', value: dash(String(manuscriptCount)) },
        { label: 'Journal papers', value: dash(String(journalPapersCount)) },
        { label: 'In Submission', value: dash(String(inSubmissionCount)) },
        { label: 'Required Revisions', value: dash(String(revisionRequested)) }
      ]
    },
    {
      id: 'peer-review',
      titleAr: 'بصيرة لتحكيم البحث العلمي',
      titleEn: 'Baseerah Peer Review',
      descAr: 'نفذ تحكيمًا منهجيًا وإحصائيًا وأخلاقيًا للمخطوطات، وأنشئ تقارير مراجعة موثقة ومفسرة.',
      descEn: 'Perform scientific peer reviews, audit statistics, evaluate methodology, and generate certified referee reports.',
      icon: Award,
      accent: 'var(--ds-path-review)',
      path: ROUTES.PEER_REVIEW,
      statusAr: activeReviews ? 'مهمة مفتوحة' : 'لا مهام جارية',
      statusEn: activeReviews ? 'Open assignment' : 'No active assignment',
      nextActionAr: activeReviews ? 'متابعة تقرير التحكيم الجاري' : 'فتح بوابة التحكيم',
      nextActionEn: activeReviews ? 'Continue active review report' : 'Open the peer-review portal',
      stats: isAr ? [
        { label: 'التحكيمات الجارية', value: dash(String(activeReviews)) },
        { label: 'التحكيمات المكتملة', value: dash(String(completedReviews)) },
        { label: 'التقارير المعلقة', value: dash(String(pendingReports)) },
        { label: 'الموعد النهائي القادم', value: dash(nextDueLabel) }
      ] : [
        { label: 'Active Reviews', value: dash(String(activeReviews)) },
        { label: 'Completed Reviews', value: dash(String(completedReviews)) },
        { label: 'Pending Reports', value: dash(String(pendingReports)) },
        { label: 'Next Deadline', value: dash(nextDueLabel) }
      ]
    },
    {
      id: 'promotion',
      titleAr: 'بصيرة للترقيات الأكاديمية',
      titleEn: 'Baseerah Academic Promotion',
      descAr: 'افهم لائحة الترقية، ونظم إنتاجك العلمي، وابنِ ملفك، واكشف النواقص، واستعد للمراجعة والتقديم.',
      descEn: 'Understand promotion bylaws, index scientific production, calculate qualification points, and evaluate file readiness.',
      icon: Briefcase,
      accent: 'var(--ds-path-promotion)',
      path: ROUTES.PROMOTION,
      statusAr: promotionApp ? (promotionApp.readiness_percentage >= 100 ? 'جاهز للمراجعة' : 'ملف غير مكتمل') : 'لا طلب بعد',
      statusEn: promotionApp ? (promotionApp.readiness_percentage >= 100 ? 'Ready for review' : 'Incomplete file') : 'No application yet',
      nextActionAr: promotionApp ? 'متابعة ملف الترقية' : 'ابدأ طلب ترقية من اللوائح المعتمدة',
      nextActionEn: promotionApp ? 'Continue the promotion file' : 'Start an application from approved bylaws',
      stats: isAr ? [
        { label: 'طلبات الترقية النشطة', value: dash(promotionApp && promotionApp.status !== 'CLOSED' ? '1' : '0') },
        { label: 'درجة اكتمال الملف الشخصي', value: dash(`${completeness}%`) },
        { label: 'الأدلة المربوطة', value: dash(String(promotionApp?.evidence_selections?.length || 0)) },
        { label: 'جاهزية الطلب', value: dash(promotionApp ? `${promotionApp.readiness_percentage}%` : '—') }
      ] : [
        { label: 'Active Promotion Files', value: dash(promotionApp && promotionApp.status !== 'CLOSED' ? '1' : '0') },
        { label: 'Profile Completeness', value: dash(`${completeness}%`) },
        { label: 'Evidence linked', value: dash(String(promotionApp?.evidence_selections?.length || 0)) },
        { label: 'Application readiness', value: dash(promotionApp ? `${promotionApp.readiness_percentage}%` : '—') }
      ]
    },
    {
      id: 'visibility',
      titleAr: 'بصيرة للهوية والانتشار الأكاديمي',
      titleEn: 'Baseerah Academic Visibility',
      descAr: 'ابنِ حضورك الرقمي المتسق، وتجنب تكرار وتداخل ملفاتك البحثية، وتابع قوة انتشار إنتاجك الأكاديمي.',
      descEn: 'Build a consistent digital presence, unify your academic name variants, and optimize citation metrics.',
      icon: Globe,
      accent: 'var(--ds-path-identity)',
      path: ROUTES.VISIBILITY,
      statusAr: completeness >= 100 ? 'مكتمل' : 'تحسين مقترح',
      statusEn: completeness >= 100 ? 'Complete' : 'Improvement suggested',
      nextActionAr: 'تدقيق الهوية وربط القنوات',
      nextActionEn: 'Audit identity and channels',
      stats: isAr ? [
        { label: 'مؤشر الانتشار الكلي', value: dash(`${completeness}%`) },
        { label: 'القنوات الأكاديمية النشطة', value: dash(`${channelsCount}/6`) },
        { label: 'إجمالي الأصول العلمية بالسجل', value: dash(String(totalAssetsCount)) },
        { label: 'تنبيهات تكرار القنوات', value: dash(duplicateChannels ? `${duplicateChannels} تكرار` : 'لا تنبيهات') }
      ] : [
        { label: 'Visibility Score', value: dash(`${completeness}%`) },
        { label: 'Linked Channels', value: dash(`${channelsCount}/6`) },
        { label: 'Total Scholarly Assets', value: dash(String(totalAssetsCount)) },
        { label: 'Duplicate-channel alerts', value: dash(duplicateChannels ? `${duplicateChannels} duplicates` : 'None') }
      ]
    }
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-8 px-4 pb-16">
      {(needsEmail || !hasProject || !profileReady) && (
        <div className="rounded-2xl border border-[var(--ds-primary)]/30 bg-[var(--ds-primary-soft)] p-4 space-y-3">
          <p className="m-0 text-[10px] font-black uppercase tracking-widest text-[var(--ds-primary)]">
            {isAr ? 'أول 15 دقيقة' : 'First 15 minutes'}
          </p>
          <ol className="m-0 p-0 list-none space-y-2 text-sm font-bold text-[var(--ds-text-primary)]">
            <li className="flex flex-wrap items-center justify-between gap-2">
              <span>{needsEmail ? (isAr ? '1. أكّد بريدك' : '1. Confirm your email') : (isAr ? '1. البريد مؤكد' : '1. Email confirmed')}</span>
              {needsEmail && (
                <Button type="button" size="sm" variant="outline" onClick={() => void resendVerification()}>
                  {isAr ? 'إعادة إرسال التأكيد' : 'Resend confirmation'}
                </Button>
              )}
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2">
              <span>{hasProject ? (isAr ? '2. المشروع جاهز' : '2. Project ready') : (isAr ? '2. أنشئ مشروعك الأول' : '2. Create your first project')}</span>
              {!hasProject && (
                <Button type="button" size="sm" onClick={() => navigate(ROUTES.PATHS)}>
                  {isAr ? 'اختيار المسار' : 'Choose a path'}
                </Button>
              )}
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2">
              <span>{profileReady ? (isAr ? '3. الملف قابل للمشاركة' : '3. Profile shareable') : (isAr ? '3. أكمل ملفك الأكاديمي ثم شاركه' : '3. Complete and share your profile')}</span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => navigate(ROUTES.PROFILE)}>
                  {isAr ? 'الملف' : 'Profile'}
                </Button>
                {publicProfileUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void navigator.clipboard.writeText(publicProfileUrl)}
                  >
                    {isAr ? 'نسخ الرابط العام' : 'Copy public link'}
                  </Button>
                )}
              </div>
            </li>
          </ol>
          {resendMsg && <p className="m-0 text-[11px] font-semibold text-[var(--ds-text-secondary)]">{resendMsg}</p>}
        </div>
      )}
      {intendedPlan && intendedPlan !== 'FREE' && (
        <div className="rounded-2xl border border-[var(--ds-accent-gold)]/30 bg-[var(--ds-accent-gold-soft)] p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-sm font-bold text-[var(--ds-text-primary)]">
            {isAr
              ? `اخترت باقة ${intendedPlan} عند التسجيل. اطلب الترقية من الفوترة داخل المؤسسة.`
              : `You selected ${intendedPlan} at signup. Request the upgrade from billing.`}
          </p>
          <Button type="button" variant="outline" onClick={() => navigate(ROUTES.BILLING)}>
            {isAr ? 'فتح الفوترة' : 'Open billing'}
          </Button>
        </div>
      )}
      
      <PathPanel accent="var(--ds-path-research)" className="p-0">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 baseerah-knowledge opacity-70" />
        <div className="relative space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <p className="m-0 text-[10px] font-bold uppercase tracking-widest text-[var(--ds-accent-gold)]">
                {isAr ? 'مركز القيادة الأكاديمية' : 'Academic Command Center'}
              </p>
              <h2 className="text-2xl md:text-3xl font-black text-[var(--ds-text-primary)] m-0 leading-tight">
                {isAr ? 'مرحباً بك في منظومة بصيرة' : 'Welcome to Baseerah'}
              </h2>
              <p className="text-sm text-[var(--ds-text-secondary)] font-medium m-0 leading-relaxed">
                {isAr
                  ? 'اختر المسار الأكاديمي التالي. الهوية واحدة، والتمييز باللون محدود على الأيقونة والحالة.'
                  : 'Choose the next academic path. One identity, with color used only as a quiet accent.'}
              </p>
            </div>
            <div className="flex gap-2.5">
              <Button onClick={() => navigate(ROUTES.PROFILE)} variant="primary" className="text-xs">
                {isAr ? 'الملف الأكاديمي الموحد' : 'Unified Profile'}
              </Button>
              <Button onClick={() => navigate(ROUTES.ASSETS)} variant="secondary" className="text-xs">
                {isAr ? 'سجل الأصول العلمية' : 'Scholarly Assets'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {portalSummary.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] px-4 py-3"
              >
                <div className="text-[10px] font-bold text-[var(--ds-text-muted)]">{item.label}</div>
                <div className="mt-1 text-lg font-black text-[var(--ds-text-primary)] ds-numeric">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-[var(--ds-primary)]/20 bg-[var(--ds-primary-soft)] p-4">
            <Activity size={16} className="text-[var(--ds-primary)] shrink-0 mt-0.5" />
            <div>
              <p className="m-0 text-[10px] font-bold uppercase tracking-widest text-[var(--ds-primary)]">
                {isAr ? 'الإجراء الأكاديمي التالي' : 'Next academic action'}
              </p>
              <p className="m-0 mt-1 text-xs font-semibold text-[var(--ds-text-primary)]">
                {isAr
                  ? `اكتمال الملف ${completeness}% · ${openActions} إجراءات مفتوحة · ${projects.length} مشروعات`
                  : `Profile ${completeness}% · ${openActions} open actions · ${projects.length} projects`}
              </p>
            </div>
          </div>
        </div>
      </section>
      </PathPanel>

      {metricsStatus === 'unavailable' && (
        <div role="alert" className="rounded-lg border border-[var(--ds-warning)]/25 bg-[var(--ds-warning-soft)] p-3 text-xs font-semibold text-[var(--ds-warning)]">
          {isAr
            ? 'تعذر تحميل مؤشرات الملف والأصول حالياً؛ ستظهر القيم عند عودة الاتصال بالخدمة.'
            : 'Profile and asset metrics are temporarily unavailable; values will appear when the service reconnects.'}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <Card 
              key={m.id} 
              variant="interactive"
              className="p-5 flex flex-col justify-between min-h-[360px] relative overflow-hidden"
              style={{ ['--path-accent' as string]: m.accent }}
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: m.accent }} />
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-lg shrink-0" style={{ background: 'color-mix(in srgb, var(--path-accent) 14%, transparent)', color: m.accent }}>
                    <Icon size={20} className="stroke-[2]" />
                    </div>
                    <h2 className="text-base font-extrabold text-[var(--ds-text-primary)] m-0 leading-snug">
                      {isAr ? m.titleAr : m.titleEn}
                    </h2>
                  </div>
                  <span className="shrink-0 rounded-full border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] px-2 py-1 text-[9px] font-black text-[var(--ds-text-muted)]">
                    {isAr ? m.statusAr : m.statusEn}
                  </span>
                </div>

                <p className="text-xs text-[var(--ds-text-secondary)] font-medium leading-relaxed m-0 min-h-12">
                  {isAr ? m.descAr : m.descEn}
                </p>

                <div className="flex items-center gap-2 rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] p-3 text-xs font-bold text-[var(--ds-text-primary)]">
                  <Activity size={15} className="shrink-0" style={{ color: m.accent }} />
                  <span className="leading-relaxed">{isAr ? m.nextActionAr : m.nextActionEn}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 text-right">
                  {m.stats.map((s, idx) => (
                    <div 
                      key={idx} 
                      className={`p-2 rounded-lg bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] space-y-0.5 ${idx === 3 ? 'col-span-2' : ''}`}
                    >
                      <span className="text-[9px] text-[var(--ds-text-muted)] font-bold block truncate">
                        {s.label}
                      </span>
                      <span className="text-xs font-black text-[var(--ds-text-primary)] ds-numeric block truncate">
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--ds-border-subtle)] flex justify-end">
                <Button 
                  onClick={() => navigate(m.path)}
                  className="flex items-center gap-1 text-xs"
                >
                  <span>{isAr ? 'فتح الإجراء التالي' : 'Open next action'}</span>
                  <ChevronRight size={14} className="rtl:rotate-180 shrink-0" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] max-w-2xl mx-auto">
        <ShieldCheck size={16} className="text-[var(--ds-primary)] shrink-0 mt-0.5" />
        <p className="text-[10px] text-[var(--ds-text-secondary)] leading-relaxed m-0 font-medium">
          {isAr
            ? 'تعتمد منظومة بصيرة على معمارية الملف الأكاديمي الموحد. أي تعديل في متغيرات البحث العلمي أو الأبحاث المنشورة سينعكس تلقائياً في حسابات نقاط ترقيتك أو فحص جاهزية نشر مخطوطاتك.'
            : 'Baseerah utilizes a unified academic asset profile. Changes in study variables or publications will automatically update your promotion points and readiness.'}
        </p>
      </div>
    </div>
  );
};
