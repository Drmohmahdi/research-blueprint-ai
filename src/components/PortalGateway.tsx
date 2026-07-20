import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { Card } from '../design-system/components/Card';
import { Button } from '../design-system/components/Button';
import { apiGetMyProfile, apiListScholarlyAssets } from '../utils/api';
import { 
  FlaskConical, 
  BookOpen, 
  Award, 
  Briefcase, 
  ChevronRight, 
  LayoutGrid, 
  ShieldCheck,
  Globe,
  User,
  Activity
} from 'lucide-react';
import { ROUTES } from '../router/routes';

export const PortalGateway: React.FC = () => {
  const { activeProject, language, projects } = useProject();
  const navigate = useNavigate();
  const isAr = language === 'ar';

  const [profile, setProfile] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [metricsStatus, setMetricsStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    const load = async () => {
      try {
        const p = await apiGetMyProfile();
        const a = await apiListScholarlyAssets();
        if (p && a) {
          setProfile(p);
          setAssets(a);
          setMetricsStatus('ready');
        } else {
          setMetricsStatus('unavailable');
        }
      } catch (e) {
        console.error("Failed to load portal metrics", e);
        setMetricsStatus('unavailable');
      }
    };
    load();
  }, []);

  const journalPapersCount = assets.filter(a => a.asset_type === 'JOURNAL_PAPER').length;
  const completeness = profile?.completeness_score || 0;
  const channelsCount = profile?.identifiers?.length || 0;
  const totalAssetsCount = assets.length;
  const openActions = [
    !activeProject?.preRegistrationHash,
    completeness < 100,
    channelsCount < 6
  ].filter(Boolean).length;
  const metricsValue = (value: string) => metricsStatus === 'ready' ? value : metricsStatus === 'loading' ? '...' : '—';
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
      colorClass: 'border-blue-500/20 hover:border-blue-500/50 bg-blue-500/5 text-blue-500',
      btnColor: 'bg-blue-600 hover:bg-blue-700',
      path: ROUTES.DASHBOARD,
      statusAr: 'جاهز للعمل',
      statusEn: 'Ready',
      nextActionAr: 'استكمال تصميم الدراسة النشطة',
      nextActionEn: 'Continue active study design',
      stats: isAr ? [
        { label: 'المشروعات البحثية', value: String(projects.length) },
        { label: 'المشروع النشط', value: activeProject ? '1' : '0' },
        { label: 'المهام المفتوحة', value: '2' },
        { label: 'آخر مشروع', value: activeProject?.titleAr ? (activeProject.titleAr.substring(0, 30) + '...') : 'لا يوجد' }
      ] : [
        { label: 'Research Projects', value: String(projects.length) },
        { label: 'Active Project', value: activeProject ? '1' : '0' },
        { label: 'Open Tasks', value: '2' },
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
      colorClass: 'border-emerald-500/20 hover:border-emerald-500/50 bg-emerald-500/5 text-emerald-500',
      btnColor: 'bg-emerald-600 hover:bg-emerald-700',
      path: ROUTES.REVIEW_SIM,
      statusAr: 'يحتاج مراجعة',
      statusEn: 'Needs review',
      nextActionAr: 'فحص جاهزية المخطوطة التالية',
      nextActionEn: 'Review next manuscript readiness',
      stats: isAr ? [
        { label: 'المخطوطات (السجل الموحد)', value: String(journalPapersCount) },
        { label: 'المجلات المحفوظة', value: '4' },
        { label: 'ملفات قيد التقديم', value: '1' },
        { label: 'تعديلات مطلوبة', value: '2' }
      ] : [
        { label: 'Manuscripts (Unified)', value: String(journalPapersCount) },
        { label: 'Saved Journals', value: '4' },
        { label: 'In Submission', value: '1' },
        { label: 'Required Revisions', value: '2' }
      ]
    },
    {
      id: 'peer-review',
      titleAr: 'بصيرة لتحكيم البحث العلمي',
      titleEn: 'Baseerah Peer Review',
      descAr: 'نفذ تحكيمًا منهجيًا وإحصائيًا وأخلاقيًا للمخطوطات، وأنشئ تقارير مراجعة موثقة ومفسرة.',
      descEn: 'Perform scientific peer reviews, audit statistics, evaluate methodology, and generate certified referee reports.',
      icon: Award,
      colorClass: 'border-purple-500/20 hover:border-purple-500/50 bg-purple-500/5 text-purple-500',
      btnColor: 'bg-purple-600 hover:bg-purple-700',
      path: ROUTES.PEER_REVIEW,
      statusAr: 'مهمة مفتوحة',
      statusEn: 'Open assignment',
      nextActionAr: 'متابعة تقرير التحكيم الجاري',
      nextActionEn: 'Continue active review report',
      stats: isAr ? [
        { label: 'التحكيمات الجارية', value: '1' },
        { label: 'التحكيمات المكتملة', value: '3' },
        { label: 'التقارير المعلقة', value: '0' },
        { label: 'الموعد النهائي القادم', value: '28 يوليو 2026' }
      ] : [
        { label: 'Active Reviews', value: '1' },
        { label: 'Completed Reviews', value: '3' },
        { label: 'Pending Reports', value: '0' },
        { label: 'Next Deadline', value: 'July 28, 2026' }
      ]
    },
    {
      id: 'promotion',
      titleAr: 'بصيرة للترقيات الأكاديمية',
      titleEn: 'Baseerah Academic Promotion',
      descAr: 'افهم لائحة الترقية، ونظم إنتاجك العلمي، وابنِ ملفك، واكشف النواقص، واستعد للمراجعة والتقديم.',
      descEn: 'Understand promotion bylaws, index scientific production, calculate qualification points, and evaluate file readiness.',
      icon: Briefcase,
      colorClass: 'border-amber-500/20 hover:border-amber-500/50 bg-amber-500/5 text-amber-500',
      btnColor: 'bg-amber-600 hover:bg-amber-700',
      path: ROUTES.PROMOTION,
      statusAr: 'ملف غير مكتمل',
      statusEn: 'Incomplete file',
      nextActionAr: 'إكمال مستندات ملف الترقية',
      nextActionEn: 'Complete promotion documents',
      stats: isAr ? [
        { label: 'طلبات الترقية النشطة', value: '1' },
        { label: 'درجة اكتمال الملف الشخصي', value: `${completeness}%` },
        { label: 'الأصول المؤهلة المربوطة', value: String(totalAssetsCount) },
        { label: 'مستندات مطلوبة للتقديم', value: '1 ناقصة' }
      ] : [
        { label: 'Active Promotion Files', value: '1' },
        { label: 'Profile Completeness', value: `${completeness}%` },
        { label: 'Eligible Assets Linked', value: String(totalAssetsCount) },
        { label: 'Missing Documents', value: '1 doc' }
      ]
    },
    {
      id: 'visibility',
      titleAr: 'بصيرة للهوية والانتشار الأكاديمي',
      titleEn: 'Baseerah Academic Visibility',
      descAr: 'ابنِ حضورك الرقمي المتسق، وتجنب تكرار وتداخل ملفاتك البحثية، وتابع قوة انتشار إنتاجك الأكاديمي.',
      descEn: 'Build a consistent digital presence, unify your academic name variants, and optimize citation metrics.',
      icon: Globe,
      colorClass: 'border-indigo-500/20 hover:border-indigo-500/50 bg-indigo-500/5 text-indigo-500',
      btnColor: 'bg-indigo-600 hover:bg-indigo-700',
      path: ROUTES.VISIBILITY,
      statusAr: 'تحسين مقترح',
      statusEn: 'Improvement suggested',
      nextActionAr: 'تدقيق الهوية وربط القنوات',
      nextActionEn: 'Audit identity and channels',
      stats: isAr ? [
        { label: 'مؤشر الانتشار الكلي', value: `${completeness}%` },
        { label: 'القنوات الأكاديمية النشطة', value: `${channelsCount}/6` },
        { label: 'إجمالي الأصول العلمية بالسجل', value: String(totalAssetsCount) },
        { label: 'تنبيهات الدمج المطلوبة', value: 'دمج ملفين Scopus' }
      ] : [
        { label: 'Visibility Score', value: `${completeness}%` },
        { label: 'Linked Channels', value: `${channelsCount}/6` },
        { label: 'Total Scholarly Assets', value: String(totalAssetsCount) },
        { label: 'Action Alerts', value: 'Merge 2 Scopus profiles' }
      ]
    }
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-8 px-4 animate-fade-in pb-16">
      
      {/* Upper Navigation for profile and assets registry */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] p-5 rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-[var(--ds-text-primary)]">
              {isAr ? 'الملف الشخصي المشترك والأصول العلمية الموحدة' : 'Shared Profile & Scholarly Assets Registry'}
            </h4>
            <p className="text-[10px] text-[var(--ds-text-secondary)] mt-0.5">
              {isAr 
                ? `مؤشر اكتمال الملف: ${completeness}% | إجمالي الأصول العلمية: ${totalAssetsCount}` 
                : `Profile Completeness: ${completeness}% | Total Scholarly Assets: ${totalAssetsCount}`}
            </p>
          </div>
        </div>

        <div className="flex gap-2.5">
          <Button 
            onClick={() => navigate(ROUTES.PROFILE)}
            variant="primary"
            className="flex items-center gap-1.5 text-xs font-black px-4 py-2 cursor-pointer rounded-lg"
          >
            <span>{isAr ? 'الملف الأكاديمي الموحد' : 'Unified Profile'}</span>
          </Button>

          <Button 
            onClick={() => navigate(ROUTES.ASSETS)}
            variant="secondary"
            className="flex items-center gap-1.5 text-xs font-black bg-[var(--ds-surface-secondary)] text-[var(--ds-text-primary)] hover:bg-[var(--ds-surface-tertiary)] px-4 py-2 cursor-pointer rounded-lg shadow-sm"
          >
            <span>{isAr ? 'سجل الأصول العلمية' : 'Scholarly Assets'}</span>
          </Button>
        </div>
      </div>

      {metricsStatus === 'unavailable' && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          {isAr
            ? 'تعذر تحميل مؤشرات الملف والأصول حالياً؛ ستظهر القيم عند عودة الاتصال بالخدمة.'
            : 'Profile and asset metrics are temporarily unavailable; values will appear when the service reconnects.'}
        </div>
      )}

      {/* Title block */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-black text-purple-600 dark:text-purple-400">
          <LayoutGrid size={13} />
          <span>{isAr ? 'منظومة الذكاء الأكاديمي' : 'Academic Intelligence Suite'}</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-[var(--ds-text-primary)] m-0 leading-tight">
          {isAr ? 'مرحبًا بك في منظومة بصيرة الأكاديمية' : 'Welcome to Baseerah Academic Suite'}
        </h1>
        <p className="text-sm text-[var(--ds-text-secondary)] font-medium max-w-xl mx-auto m-0 leading-relaxed">
          {isAr 
            ? 'اختر مساحة العمل أو الموديول العلمي الذي ترغب بالبدء فيه الآن للتكامل مع الأصل البحثي الموحد.' 
            : 'Select the scholarly workspace or module you wish to start with to integrate with your academic assets.'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {portalSummary.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] px-4 py-3 text-center shadow-sm"
          >
            <div className="text-[10px] font-bold text-[var(--ds-text-muted)]">{item.label}</div>
            <div className="mt-1 text-lg font-black text-[var(--ds-text-primary)]">{item.value}</div>
          </div>
        ))}
      </div>

      {/* Grid of Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-4">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <Card 
              key={m.id} 
              className={`p-5 border transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between min-h-[380px] rounded-xl ${m.colorClass}`}
            >
              <div className="space-y-4">
                {/* Header Icon + Title */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-lg bg-current/10 shrink-0">
                    <Icon size={20} className="stroke-[2.5]" />
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
                  <Activity size={15} className="text-[var(--ds-primary)] shrink-0" />
                  <span className="leading-relaxed">{isAr ? m.nextActionAr : m.nextActionEn}</span>
                </div>

                {/* Micro Stats Grid */}
                <div className="grid grid-cols-2 gap-2 pt-2 text-right">
                  {m.stats.map((s, idx) => (
                    <div 
                      key={idx} 
                      className={`p-2 rounded-lg bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] space-y-0.5 ${idx === 3 ? 'col-span-2' : ''}`}
                    >
                      <span className="text-[9px] text-[var(--ds-text-muted)] font-bold block truncate">
                        {s.label}
                      </span>
                      <span className="text-xs font-black text-[var(--ds-text-primary)] block truncate">
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Enter Button */}
              <div className="pt-4 border-t border-[var(--ds-border-subtle)] flex justify-end">
                <Button 
                  onClick={() => navigate(m.path)}
                  className={`flex items-center gap-1 text-xs font-black text-white px-4 py-2 cursor-pointer rounded-xl ${m.btnColor}`}
                >
                  <span>{isAr ? 'فتح الإجراء التالي' : 'Open next action'}</span>
                  <ChevronRight size={14} className="rtl:rotate-180 shrink-0" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Info card */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] max-w-2xl mx-auto">
        <ShieldCheck size={16} className="text-purple-500 shrink-0 mt-0.5" />
        <p className="text-[10px] text-[var(--ds-text-secondary)] leading-relaxed m-0 font-medium">
          {isAr
            ? 'تعتمد منظومة بصيرة على معمارية الملف الأكاديمي الموحد. أي تعديل في متغيرات البحث العلمي أو الأبحاث المنشورة سينعكس تلقائياً في حسابات نقاط ترقيتك أو فحص جاهزية نشر مخطوطاتك.'
            : 'Baseerah utilizes a unified academic asset profile. Changes in study variables or publications will automatically update your promotion points and readiness.'}
        </p>
      </div>
    </div>
  );
};
